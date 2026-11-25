-- Events written before the email worker existed have no consumer. Mark them published once, so the first run of the
-- worker does not mail people about old orders. New events are untouched.
update public.outbox_events set published_at = now(), last_error = 'before the email worker existed' where published_at is null;
