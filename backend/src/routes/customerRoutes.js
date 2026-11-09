const express = require('express');
const router = express.Router();
const customerController = require('../controllers/customerController');
const auth = require('../middleware/auth');

router.use(auth);

router.get('/', customerController.getCustomers);
router.get('/:id', customerController.getCustomerById);
router.post('/', customerController.createCustomer);
router.put('/:id', customerController.updateCustomer);
router.delete('/:id', customerController.deleteCustomer);

// Multi-GST Management
router.post('/:id/gst-numbers', customerController.addCustomerGstNumber);
router.delete('/:id/gst-numbers/:gstId', customerController.deleteCustomerGstNumber);

// Previous Invoice Config & DC Fields for Customer
router.get('/:id/previous-config', customerController.getCustomerPreviousConfig);
router.put('/:id/column-preferences', customerController.saveCustomerColumnPreferences);

module.exports = router;

