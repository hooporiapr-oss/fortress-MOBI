-- Run only after all draft schemas in an isolated synthetic test database.
-- No production data required. These tests verify payload validation, not end-to-end auth.
do $$
begin
 if not coach_memory_private.valid_memory_payload('bpm_confirmation','{"bpm":120,"source":"reaction_speed"}') then raise exception 'valid BPM rejected'; end if;
 if coach_memory_private.valid_memory_payload('bpm_confirmation','{"bpm":120,"source":"ritnome"}') then raise exception 'Ritnome substitution accepted'; end if;
 if coach_memory_private.valid_memory_payload('bpm_confirmation','{"bpm":0,"source":"reaction_speed"}') then raise exception 'zero accepted'; end if;
 if coach_memory_private.valid_memory_payload('bpm_confirmation','{"bpm":120,"source":"reaction_speed","name":"synthetic"}') then raise exception 'unexpected field accepted'; end if;
 if not coach_memory_private.valid_memory_payload('training_plan','{"stage":"5-6","bpm":null,"days":3,"stations":["recognition","recall"]}') then raise exception 'memory-only plan rejected'; end if;
 if coach_memory_private.valid_memory_payload('training_plan','{"stage":"5-6","bpm":null,"days":3,"stations":["zn"]}') then raise exception 'unconfirmed rhythm accepted'; end if;
 if coach_memory_private.valid_memory_payload('goal','{"metric":"recall","baseline":5,"target":4}') then raise exception 'non-increasing goal accepted'; end if;
 if not coach_memory_private.valid_memory_payload('cycle_evaluation','{"start":"2026-11-01","days":7,"prior_attempts":5,"cycle_attempts":7,"complete":true}') then raise exception 'valid cycle rejected'; end if;
 if coach_memory_private.valid_memory_payload('cycle_evaluation','{"start":"2026-02-30","days":7,"prior_attempts":5,"cycle_attempts":7,"complete":true}') then raise exception 'invalid date accepted'; end if;
 if coach_memory_private.valid_memory_payload('coaching_decision','{"reason":"maintain","notes":"synthetic"}') then raise exception 'unrestricted notes accepted'; end if;
 if coach_memory_private.valid_memory_payload('correction','{"reason":"entry_error","arbitrary":"value"}') then raise exception 'extra correction field accepted'; end if;
 if has_function_privilege('anon','coach_memory_private.append_memory(uuid,uuid,text,date,uuid,jsonb,uuid)','EXECUTE') then raise exception 'anon can execute append'; end if;
 if has_function_privilege('authenticated','coach_memory_private.read_memory(uuid,uuid,integer,timestamptz,uuid)','EXECUTE') then raise exception 'browser can execute read'; end if;
end;
$$;
-- Additional required fixture tests: wrong membership, revoked coach, expired membership,
-- same request same payload, same request changed payload, cross-membership correction,
-- concurrent revocation vs write, pagination and verified actor/session boundary.
