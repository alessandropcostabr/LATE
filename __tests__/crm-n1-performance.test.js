const pipelineController = require('../controllers/crm/pipelineController');
const PipelineModel = require('../models/pipeline');

jest.mock('../models/pipeline', () => ({
  listPipelinesWithStages: jest.fn(),
  listPipelines: jest.fn(),
  getStages: jest.fn(),
}));

describe('CRM N+1 guard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('listPipelines usa listPipelinesWithStages (sem loop N+1)', async () => {
    PipelineModel.listPipelinesWithStages.mockResolvedValueOnce([]);

    const req = {};
    const res = {
      json: jest.fn(),
      status: jest.fn(() => res),
    };

    await pipelineController.listPipelines(req, res);

    expect(PipelineModel.listPipelinesWithStages).toHaveBeenCalledTimes(1);
    expect(PipelineModel.getStages).not.toHaveBeenCalled();
    expect(PipelineModel.listPipelines).not.toHaveBeenCalled();
  });
});
