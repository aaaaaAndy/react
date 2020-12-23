/**
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow
 */

import type {DispatchConfig} from './ReactSyntheticEventType';
import type {
  AnyNativeEvent,
  PluginName,
  PluginModule,
} from './PluginModuleType';

import invariant from 'shared/invariant';

type NamesToPlugins = {[key: PluginName]: PluginModule<AnyNativeEvent>, ...};
type EventPluginOrder = null | Array<PluginName>;

/**
 * Injectable ordering of event plugins.
 * @example
 *  eventPluginOrder = [
 *    'ResponderEventPlugin',
 *    'SimpleEventPlugin',
 *    'EnterLeaveEventPlugin',
 *    'ChangeEventPlugin',
 *    'SelectEventPlugin',
 *    'BeforeInputEventPlugin',
 *  ]
 */
let eventPluginOrder: EventPluginOrder = null;

/**
 * Injectable mapping from names to event plugin modules.
 * @example
 *  namesToPlugins = {
 *    SimpleEventPlugin: SimpleEventPlugin,
 *    EnterLeaveEventPlugin: EnterLeaveEventPlugin,
 *    ChangeEventPlugin: ChangeEventPlugin,
 *    SelectEventPlugin: SelectEventPlugin,
 *    BeforeInputEventPlugin: BeforeInputEventPlugin,
 *  }
 */
const namesToPlugins: NamesToPlugins = {};

/**
 * Recomputes the plugin list using the injected plugins and plugin ordering.
 *
 * @private
 */
function recomputePluginOrdering(): void {
  if (!eventPluginOrder) {
    // Wait until an `eventPluginOrder` is injected.
    return;
  }

  for (const pluginName in namesToPlugins) {
    const pluginModule = namesToPlugins[pluginName];
    const pluginIndex = eventPluginOrder.indexOf(pluginName);

    if (plugins[pluginIndex]) {
      continue;
    }

    plugins[pluginIndex] = pluginModule;
    const publishedEvents = pluginModule.eventTypes;

    for (const eventName in publishedEvents) {
      publishEventForPlugin(
        publishedEvents[eventName],
        pluginModule,
        eventName,
      );
    }
  }
}

/**
 * Publishes an event so that it can be dispatched by the supplied plugin.
 *
 * @param {object} dispatchConfig Dispatch configuration for the event.
 * @param {object} PluginModule Plugin publishing the event.
 * @return {boolean} True if the event was successfully published.
 * @private
 */
function publishEventForPlugin(
  dispatchConfig: DispatchConfig,
  pluginModule: PluginModule<AnyNativeEvent>,
  eventName: string,
): boolean {
	// eventNameDispatchConfigs = { change: {} };
  eventNameDispatchConfigs[eventName] = dispatchConfig;

  const phasedRegistrationNames = dispatchConfig.phasedRegistrationNames;
  if (phasedRegistrationNames) {
    for (const phaseName in phasedRegistrationNames) {
      if (phasedRegistrationNames.hasOwnProperty(phaseName)) {
        const phasedRegistrationName = phasedRegistrationNames[phaseName];
        publishRegistrationName(
          phasedRegistrationName, // onChange
          pluginModule, // ChangeEventPlugin,最外层那个对象
          eventName, // change
        );
      }
    }
    return true;
  } else if (dispatchConfig.registrationName) {
    publishRegistrationName(
      dispatchConfig.registrationName,
      pluginModule,
      eventName,
    );
    return true;
  }
  return false;
}

/**
 * Publishes a registration name that is used to identify dispatched events.
 *
 * @param {string} registrationName Registration name to add.
 * @param {object} PluginModule Plugin publishing the event.
 * @private
 */
function publishRegistrationName(
  registrationName: string, // onChange
  pluginModule: PluginModule<AnyNativeEvent>,
  eventName: string, // change
): void {
  registrationNameModules[registrationName] = pluginModule;
  registrationNameDependencies[registrationName] = pluginModule.eventTypes[eventName].dependencies;

  if (__DEV__) {
    const lowerCasedName = registrationName.toLowerCase();
    possibleRegistrationNames[lowerCasedName] = registrationName;

    if (registrationName === 'onDoubleClick') {
      possibleRegistrationNames.ondblclick = registrationName;
    }
  }
}

/**
 * Registers plugins so that they can extract and dispatch events.
 */

/**
 * Ordered list of injected plugins.
 * @example
 *  plugins = [
 *    undefined,
 *    SimpleEventPlugin,
 *    EnterLeaveEventPlugin,
 *    ChangeEventPlugin,
 *    SelectEventPlugin,
 *    BeforeInputEventPlugin,
 *  ]
 */
export const plugins = [];

/**
 * Mapping from event name to dispatch config
 * @example
 * eventNameDispatchConfigs = { change: {} }
 */
export const eventNameDispatchConfigs = {};

/**
 * Mapping from registration name to plugin module
 * @example
 *  registrationNameModules = { onChange: {} }
 */
export const registrationNameModules = {};

/**
 * Mapping from registration name to event name
 * @example
 *  registrationNameDependencies = { onChange: [] }
 */
export const registrationNameDependencies = {};

/**
 * Mapping from lowercase registration names to the properly cased version,
 * used to warn in the case of missing event handlers. Available
 * only in __DEV__.
 * @type {Object}
 */
export const possibleRegistrationNames = __DEV__ ? {} : (null: any);
// Trust the developer to only use possibleRegistrationNames in __DEV__

/**
 * Injects an ordering of plugins (by plugin name). This allows the ordering
 * to be decoupled from injection of the actual plugins so that ordering is
 * always deterministic regardless of packaging, on-the-fly injection, etc.
 *
 * @param {array} InjectedEventPluginOrder
 * @internal
 */
export function injectEventPluginOrder(
  injectedEventPluginOrder: EventPluginOrder,
): void {
  invariant(
    !eventPluginOrder,
    'EventPluginRegistry: Cannot inject event plugin ordering more than ' +
      'once. You are likely trying to load more than one copy of React.',
  );
  // Clone the ordering so it cannot be dynamically mutated.
  // 浅复制，克隆数组，可以动态修改，不会影响原数组
  eventPluginOrder = Array.prototype.slice.call(injectedEventPluginOrder);
  recomputePluginOrdering();
}

/**
 * Injects plugins to be used by plugin event system. The plugin names must be
 * in the ordering injected by `injectEventPluginOrder`.
 *
 * Plugins can be injected as part of page initialization or on-the-fly.
 *
 * @param {object} injectedNamesToPlugins Map from names to plugin modules.
 * @internal
 */
export function injectEventPluginsByName(
  injectedNamesToPlugins: NamesToPlugins,
): void {
  let isOrderingDirty = false;
  for (const pluginName in injectedNamesToPlugins) {
    if (!injectedNamesToPlugins.hasOwnProperty(pluginName)) {
      continue;
    }
    // 循环获取pluginModule
    const pluginModule = injectedNamesToPlugins[pluginName];

    if (
      !namesToPlugins.hasOwnProperty(pluginName) ||
      namesToPlugins[pluginName] !== pluginModule
    ) {
      invariant(
        !namesToPlugins[pluginName],
        'EventPluginRegistry: Cannot inject two different event plugins ' +
          'using the same name, `%s`.',
        pluginName,
      );
      // 把injectedNamesToPlugins都插入到namesToPlugins上
      namesToPlugins[pluginName] = pluginModule;
      isOrderingDirty = true;
    }
  }

  if (isOrderingDirty) {
    recomputePluginOrdering();
  }
}
