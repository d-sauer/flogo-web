import cloneDeep from "lodash/cloneDeep";
import sinon from 'sinon';
import {ResourceStorageRegistryMock} from './resource-storage-mock';
import {AppImporterFactory} from '../app-importer-factory';
import {commonTestCases, makeImporterContext} from "./test-utils.spec";
import {TestOptions} from "./test-options";
import {ActionsImporter} from "../device/actions-importer";
import {TriggersHandlersImporter} from "../device/triggers-handlers-importer";

const app = require('./samples/device-app');
const testData = require('./samples/device-test-data');

describe('Importer: Device', function () {

  before(async function () {
    this.importerFactory = new AppImporterFactory(ResourceStorageRegistryMock);
    this.importerContext = makeImporterContext(this.importerFactory);
    this.testOptions = new TestOptions({
      updateTasksRefCb: function (app) {
        app.actions[0].data.flow.tasks[0].activityRef = "some.domain/path/to/activity";
        return app;
      },
      depsConstructors: {
        actionsImporter: ActionsImporter,
        triggersHandlersImporter: TriggersHandlersImporter
      },
      expectedActions: [...testData.expect.extractActions],
      expectedTriggers: [...testData.expect.extractTriggers],
      expectedReconciledTriggers: [...testData.expect.reconciledTriggers]
    });
  });

  beforeEach(function(){
    this.appToImport = cloneDeep(app);
    this.sinonSandbox = sinon.sandbox.create();
  });

  afterEach(function(){
    this.sinonSandbox.restore();
  });

  commonTestCases('device');

});
