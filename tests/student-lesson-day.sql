-- Read-only regression checks to run after the migration in a database test/admin session.
select
 portal_private.calendar_habitual('{"weekdays":"4","time":"21:00"}','2026-11-26','','') as habitual_thursday,
 not portal_private.calendar_habitual('{"weekdays":"4","time":"21:00","changes":[{"from":"2026-11-26","weekdays":"3","time":"21:00"}]}','2026-11-26','','') as changed_schedule,
 not portal_private.calendar_habitual('{"weekdays":"4","time":"21:00","end":"2026-11-25"}','2026-11-26','','') as ended_schedule,
 portal_private.calendar_day_visible('{"status":"planned","rescheduled_from":"2026-11-25"}',false,false,false) as rescheduled_target,
 not portal_private.calendar_day_visible('{"status":"rescheduled","rescheduled_to":"2026-11-27"}',false,true,false) as rescheduled_source,
 portal_private.calendar_day_visible('{"status":"planned","original":"2026-11-25"}',false,false,false) as replacement,
 not portal_private.calendar_day_visible('{"status":"teacher"}',false,true,false) as cancelled,
 not portal_private.calendar_day_visible('{"status":"absent"}',false,true,false) as absent,
 not portal_private.calendar_day_visible('{"skip":true}',false,true,false) as deleted,
 portal_private.calendar_unavailable('[]','2027-01-01') as national_holiday,
 portal_private.calendar_unavailable('[{"start":"2026-12-18","end":"2027-01-03","status":"break"}]','2026-12-22') as recess,
 not portal_private.calendar_day_visible(null,false,true,true) as no_habitual_on_holiday,
 portal_private.calendar_day_visible('{"status":"done"}',false,false,true) as holiday_exception,
 portal_private.calendar_day_visible(null,true,false,true) as registered_exception;
