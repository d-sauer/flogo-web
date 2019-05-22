import { get, cloneDeep, fromPairs, isArray, pick } from 'lodash';
import { ValueType } from '@flogo-web/core';

const TASK_TYPE = {
  0: 'TASK_ROOT',
  1: 'TASK',
  2: 'TASK_ITERATOR',
  3: 'TASK_BRANCH',
  4: 'TASK_SUB_PROC',
  TASK_ROOT: 0,
  TASK: 1,
  TASK_ITERATOR: 2,
  TASK_BRANCH: 3,
  TASK_SUB_PROC: 4,
};

export class ItemFactory {
  static getDefaultTaskProperties(installed) {
    const defaults = {
      name: '',
      description: '',
      settings: {},
      ref: '',
    };
    return Object.assign({}, defaults, pick(installed, ['name', 'description', 'ref']));
  }

  static getDefaultTriggerProperties(installed) {
    const defaults = {
      name: '',
      version: '',
      homepage: '',
      description: '',
      installed: true,
      settings: {},
      outputs: [],
      ref: '',
      handler: { settings: [] },
      __props: {
        errors: [],
      },
      __status: {},
    };
    return Object.assign(
      {},
      defaults,
      pick(installed, ['name', 'version', 'homepage', 'description', 'ref'])
    );
  }

  static makeTrigger(trigger: {
    installed: any;
    cli: any;
    handlerSetting: any;
    node: any;
  }): any {
    // todo: what does cli means in this context??
    const { installed, cli, handlerSetting } = trigger;
    const item = Object.assign(
      {},
      this.getDefaultTriggerProperties(installed),
      { id: trigger.node.taskID },
      {
        nodeId: trigger.node.taskID,
        type: 0,
        triggerType: installed.name,
        settings: [],
      }
    );

    const settings = get(cli, 'settings', {});
    const triggerSchemaSettings = isArray(installed.settings) ? installed.settings : [];
    item.settings = mergeAttributesWithSchema(settings, triggerSchemaSettings);

    const handlerSettings = get(installed, 'handler.settings', []);
    item.handler.settings = mergeAttributesWithSchema(
      handlerSetting.settings || {},
      handlerSettings
    );

    const mapType = prop => ({
      name: prop.name,
      type: prop.type || ValueType.String,
    });
    // -----------------
    // set outputs
    const outputs = installed.outputs || [];
    item.outputs = outputs.map(mapType);

    const reply = installed.reply || [];
    item['reply'] = reply.map(mapType);

    return item;
  }

  static makeItem(activitySource: { activitySchema; taskInstance }) {
    const { activitySchema, taskInstance } = activitySource;

    const attributes = taskInstance.attributes || [];

    const item = {
      ...this.getDefaultTaskProperties(activitySchema),
      id: taskInstance.id,
      name: taskInstance.name,
      description: taskInstance.description,
      inputMappings: taskInstance.inputMappings || {},
      type: TASK_TYPE[taskInstance.type]
        ? TASK_TYPE[TASK_TYPE[taskInstance.type]]
        : TASK_TYPE.TASK,
      settings: taskInstance.settings || {},
      return: !!activitySchema.return,
      activitySettings: taskInstance.activitySettings || {},
      input: fromPairs(attributes.map(attr => [attr.name, attr.value])),
    };
    return item;
  }

  static makeBranch(branch) {
    return {
      id: branch.taskID,
      type: TASK_TYPE.TASK_BRANCH,
      condition: branch.condition,
    };
  }
}

function mergeAttributesWithSchema(
  properties: { [key: string]: any },
  schemaAttributes: any[]
) {
  return schemaAttributes.map(attribute => {
    const mappedAttribute = cloneDeep(attribute);
    if (properties[attribute.name]) {
      mappedAttribute.value = properties[attribute.name];
    }
    return mappedAttribute;
  });
}