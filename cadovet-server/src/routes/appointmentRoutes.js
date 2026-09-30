const express = require('express');
const router = express.Router();
const validateId = require('../middleware/validateId');
router.param('id', validateId);
const appointmentController = require('../controllers/appointmentController');
const { authenticateUser, authorizePermission } = require('../middleware/authMiddleware');

// Public booking endpoint (home visits & catalog orders)
// Unauthenticated, so it is throttled per client IP (default 30 bookings per hour; PUBLIC_BOOKING_RATE_LIMIT overrides).
const { rateLimit } = require('../utils/rateLimit');
const publicBookingLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: parseInt(process.env.PUBLIC_BOOKING_RATE_LIMIT || '30', 10),
  key: (req) => `public-booking:${req.ip}`,
  message: 'Too many booking requests from this address. Please try again later or call us.',
});
router.post('/public', publicBookingLimiter, appointmentController.publicBookAppointment);

router.use(authenticateUser);

router.get('/', authorizePermission('APPOINTMENT_VIEW'), appointmentController.listAppointments);
// Must be declared before '/:id'
router.get('/availability', authorizePermission('APPOINTMENT_VIEW'), appointmentController.getAvailability);
router.get('/:id', authorizePermission('APPOINTMENT_VIEW'), appointmentController.getAppointment);
router.post('/', authorizePermission('APPOINTMENT_CREATE'), appointmentController.createAppointment);
// Operational head / admin: one form for a phone call — finds or creates the pet parent and pet, then either
// books a real slot or saves the call as declined (see callIntake for why the customer/pet save never depends
// on which button gets clicked).
router.post('/call-intake', authorizePermission('APPOINTMENT_CREATE'), appointmentController.callIntake);
// Customer self-service (ownership enforced in the controller)
router.patch('/:id/cancel', authorizePermission('APPOINTMENT_CANCEL'), appointmentController.cancelAppointment);
router.patch('/:id/reschedule', authorizePermission('APPOINTMENT_CREATE'), appointmentController.rescheduleAppointment);
// Only the operational head (and admin) may assign a doctor; from then on that doctor can see the appointment.
router.patch('/:id/assign', authorizePermission('APPOINTMENT_ASSIGN'), appointmentController.assignDoctor);
router.patch('/:id/status', authorizePermission('APPOINTMENT_UPDATE'), appointmentController.updateStatus);
router.put('/:id', authorizePermission('APPOINTMENT_UPDATE'), appointmentController.updateAppointment);

module.exports = router;
