-- Starting data so a fresh database is usable straight away. Everything here is editable from the
-- admin portal. Nothing in this file is marketing content: no ratings, patient counts or testimonials.

insert into app_settings (id) values (1) on conflict (id) do nothing;

insert into site_settings (id, address_line1, address_line2, pincode, working_hours, closed_day)
values (
  1,
  '1st Floor, BKP Lakshmi Luxus, Sai Ranga Theatre Rd, Nandini Nagar, Madhava Nagar',
  'Hafeezpet, Miyapur, Hyderabad, Telangana',
  '500049',
  'Mon-Sat: 9 am - 12 pm & 5 pm - 10 pm',
  'Sun: Holiday'
)
on conflict (id) do nothing;

insert into appointment_types (id, name, description, active, sort_order) values
  ('type-general',  'General Consultation', 'First visit or general skin and hair check-up', true, 0),
  ('type-hair',     'Hair Treatment',       'Hair loss, PRP, transplant and related care',   true, 1),
  ('type-skin',     'Skin Treatment',       'Acne, pigmentation, laser and related care',    true, 2),
  ('type-followup', 'Follow-up Visit',      'Review of an ongoing treatment',                true, 3)
on conflict (id) do nothing;

insert into time_slots (id, name, start_time, end_time, capacity, active) values
  ('slot-0900', '9:00 AM - 10:00 AM',  '09:00', '10:00', 25, true),
  ('slot-1000', '10:00 AM - 11:00 AM', '10:00', '11:00', 25, true),
  ('slot-1100', '11:00 AM - 12:00 PM', '11:00', '12:00', 25, true),
  ('slot-1700', '5:00 PM - 6:00 PM',   '17:00', '18:00', 25, true),
  ('slot-1800', '6:00 PM - 7:00 PM',   '18:00', '19:00', 25, true),
  ('slot-1900', '7:00 PM - 8:00 PM',   '19:00', '20:00', 25, true),
  ('slot-2000', '8:00 PM - 9:00 PM',   '20:00', '21:00', 25, true),
  ('slot-2100', '9:00 PM - 10:00 PM',  '21:00', '22:00', 25, true)
on conflict (id) do nothing;

-- The senior consultant. Photo and details are added from Admin > Doctors.
insert into doctors (id, name, qualification, designation, reg_no, experience, specialization, bio, message, image, is_senior, published, sort_order)
values (
  'dr-lakshmi-villa',
  'Dr. LAKSHMI KUMARI VILLA',
  'MD, DVL',
  'Senior Consultant',
  '84127',
  18,
  array['DERMATOLOGY', 'TRICHOLOGY', 'COSMETOLOGY', 'LASER SPECIALIST'],
  'Dr. Lakshmi Kumari Villa is a dermatologist with a special interest in hair restoration and advanced skin treatments.',
  '',
  '',
  true,
  true,
  0
)
on conflict (id) do nothing;

insert into faqs (id, question, answer, sort_order, published) values
  ('faq-booking', 'How do I book an appointment?',
   'Use "Book appointment" on this website. Choose a date and a time slot, say whether you are a new or follow-up patient, choose Dr. Lakshmi or Other Doctors, and enter your name, age, gender and phone number. The clinic confirms your booking.', 0, true),
  ('faq-bring', 'What should I bring for my first visit?',
   'Any previous reports or prescriptions about your hair or skin, a list of the medicines you take, and a photo ID. Please arrive 10 to 15 minutes before your slot.', 1, true),
  ('faq-time', 'How long does a consultation take?',
   'It depends on your concern. Your doctor will explain the plan and what to expect at the visit.', 2, true),
  ('faq-change', 'Can I cancel or reschedule?',
   'Yes. Your booking message includes links to cancel or reschedule. Please change a booking as early as you can so the slot can be used by another patient.', 3, true)
on conflict (id) do nothing;
