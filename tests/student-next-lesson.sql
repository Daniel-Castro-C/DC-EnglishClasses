-- Synthetic payloads: read-only; no student data or registered lessons created.
select
 portal_private.calendar_next_student_day('2026-11-27','{"weekdays":"4","time":"21:00"}','[]','[]','{}','','')='2026-12-03'::date as next_thursday,
 portal_private.calendar_next_student_day('2026-11-27','{"weekdays":"5","time":"21:00"}','[]','[]','{}','','')='2026-11-27'::date as today,
 portal_private.calendar_next_student_day('2026-11-27','{"weekdays":"5","time":"21:00","events":{"2026-11-27":{"status":"rescheduled","rescheduled_to":"2026-11-28"},"2026-11-28":{"status":"planned","rescheduled_from":"2026-11-27"}}}','[]','[]','{}','','')='2026-11-28'::date as reschedule,
 portal_private.calendar_next_student_day('2026-11-27','{"weekdays":"5","time":"21:00","events":{"2026-11-28":{"status":"planned","original":"2026-11-20"},"2026-11-27":{"status":"teacher"}}}','[]','[]','{}','','')='2026-11-28'::date as replacement,
 portal_private.calendar_next_student_day('2026-11-27','{"weekdays":"5","time":"21:00"}','[]','[]','{"2026-11-27":false}','','')='2026-12-04'::date as registered_absence,
 portal_private.calendar_next_student_day('2026-12-18','{"weekdays":"5","time":"21:00"}','[]','[{"start":"2026-12-18","end":"2027-01-03","status":"break"}]','{}','','')='2027-01-08'::date as recess,
 portal_private.calendar_next_student_day('2027-01-01','{"weekdays":"5","time":"21:00"}','[]','[]','{}','','')='2027-01-08'::date as national_holiday,
 portal_private.calendar_next_student_day('2026-11-27','{"weekdays":"5","time":"21:00","end":"2026-11-26"}','[]','[]','{}','','') is null as ended,
 portal_private.calendar_next_student_day('2026-11-27','{"start":"2030-11-01","weekdays":"5","time":"21:00"}','[]','[]','{}','','')='2030-11-01'::date as distant_future,
 portal_private.calendar_next_student_day('2026-11-27','{}','[{"id":"g","schedule":{"start":"2026-11-01","days":"5","time":"21:00","calendar_events":{"2026-11-27":{"status":"absent"}}}}]','[]','{}','','')='2026-12-04'::date as group_absence,
 portal_private.calendar_next_student_day('2026-11-27','{"events":{"2026-11-27":{"group_id":"g","attendance_override":"absent"}}}','[{"id":"g","schedule":{"start":"2026-11-01","days":"5","time":"21:00","calendar_events":{"2026-11-27":{"status":"done"}}}}]','[]','{}','','')='2026-12-04'::date as individual_absence,
 portal_private.calendar_next_student_day('2026-11-27','{}','[]','[]','{"2026-12-01":true}','','')='2026-12-01'::date as registered_extra;
