const { CacheKeys, EModelEndpoint, orderEndpointsConfig } = require('librechat-data-provider');
const loadDefaultEndpointsConfig = require('./loadDefaultEConfig');
const loadConfigEndpoints = require('./loadConfigEndpoints');
const getLogStores = require('~/cache/getLogStores');

/**
 *
 * @param {ServerRequest} req
 * @returns {Promise<TEndpointsConfig>}
 */
async function getEndpointsConfig(req) {
  const cache = getLogStores(CacheKeys.CONFIG_STORE);
  const cachedEndpointsConfig = await cache.get(CacheKeys.ENDPOINT_CONFIG);
  if (cachedEndpointsConfig) {
    return cachedEndpointsConfig;
  }

  const defaultEndpointsConfig = await loadDefaultEndpointsConfig(req);
  const customConfigEndpoints = await loadConfigEndpoints(req);

  /** @type {TEndpointsConfig} */
  const mergedConfig = { ...defaultEndpointsConfig, ...customConfigEndpoints };
  if (mergedConfig[EModelEndpoint.assistants] && req.app.locals?.[EModelEndpoint.assistants]) {
    const { disableBuilder, retrievalModels, capabilities, version, ..._rest } =
      req.app.locals[EModelEndpoint.assistants];

    mergedConfig[EModelEndpoint.assistants] = {
      ...mergedConfig[EModelEndpoint.assistants],
      version,
      retrievalModels,
      disableBuilder,
      capabilities,
    };
  }
  if (mergedConfig[EModelEndpoint.agents] && req.app.locals?.[EModelEndpoint.agents]) {
    const { disableBuilder, capabilities, allowedProviders, ..._rest } =
      req.app.locals[EModelEndpoint.agents];

    mergedConfig[EModelEndpoint.agents] = {
      ...mergedConfig[EModelEndpoint.agents],
      allowedProviders,
      disableBuilder,
      capabilities,
    };
  }

  if (
    mergedConfig[EModelEndpoint.azureAssistants] &&
    req.app.locals?.[EModelEndpoint.azureAssistants]
  ) {
    const { disableBuilder, retrievalModels, capabilities, version, ..._rest } =
      req.app.locals[EModelEndpoint.azureAssistants];

    mergedConfig[EModelEndpoint.azureAssistants] = {
      ...mergedConfig[EModelEndpoint.azureAssistants],
      version,
      retrievalModels,
      disableBuilder,
      capabilities,
    };
  }

  if (mergedConfig[EModelEndpoint.bedrock] && req.app.locals?.[EModelEndpoint.bedrock]) {
    const { availableRegions } = req.app.locals[EModelEndpoint.bedrock];
    mergedConfig[EModelEndpoint.bedrock] = {
      ...mergedConfig[EModelEndpoint.bedrock],
      availableRegions,
    };
  }

  const endpointsConfig = orderEndpointsConfig(mergedConfig);
  const sortedConfig = preOrderEndpoints(endpointsConfig);

  await cache.set(CacheKeys.ENDPOINT_CONFIG, sortedConfig);
  return sortedConfig;
}

/**
 * @param {ServerRequest} req
 * @param {import('librechat-data-provider').AgentCapabilities} capability
 * @returns {Promise<boolean>}
 */
const checkCapability = async (req, capability) => {
  const endpointsConfig = await getEndpointsConfig(req);
  const capabilities = endpointsConfig?.[EModelEndpoint.agents]?.capabilities ?? [];
  return capabilities.includes(capability);
};

const preOrderEndpoints = (mergedConfig) => {
  console.log(mergedConfig, 'beforeOrderEndpoints');
  const defualtEndpointsOrder = {
    [EModelEndpoint.openAI]: 10,
    [EModelEndpoint.azureOpenAI]: 20,
    [EModelEndpoint.google]: 30,
    [EModelEndpoint.bedrock]: 40,
    [EModelEndpoint.agents]: 50,
    [EModelEndpoint.assistants]: 60,
    [EModelEndpoint.azureAssistants]: 80,
    [EModelEndpoint.anthropic]: 90,
  };
  const customSeek = 40;

  let customIdx = 0;
  // 因为mergedConfig是对象而不是数组，需要遍历对象的键
  Object.keys(mergedConfig).forEach((key) => {
    const endpoint = mergedConfig[key];
    if(key== 'gptPlugins'){
      // 如果gptPlugins的值为false，前端不显示内容
      mergedConfig[key] = false;
      // defualtEndpointsOrder[key];
      return;
    }
    // console.log(key, defualtEndpointsOrder[key], 'endpoint key');
    if (endpoint.type === 'custom') {
      customIdx += 1;
      endpoint.order = customSeek + customIdx;
    } else if (defualtEndpointsOrder[key]) {
      // 如果在默认顺序对象中找到对应键，则应用该顺序值
      endpoint.order = defualtEndpointsOrder[key] || 99999;
    }else{
      // 如果没有找到对应键，则设置为99999
      endpoint.order = 99999;
    }
  });
  return mergedConfig;
};
module.exports = { getEndpointsConfig, checkCapability };
