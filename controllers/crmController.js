// controllers/crmController.js
// Wrapper de compatibilidade: mantém import antigo apontando para os novos controllers.

const pipelineController = require('./crm/pipelineController');
const leadController = require('./crm/leadController');
const opportunityController = require('./crm/opportunityController');
const activityController = require('./crm/activityController');
const statsController = require('./crm/statsController');

module.exports = {
  ...pipelineController,
  ...leadController,
  ...opportunityController,
  ...activityController,
  ...statsController,
};
