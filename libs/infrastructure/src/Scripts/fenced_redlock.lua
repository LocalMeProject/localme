-- Fenced Redlock Mutex with monotonic fencing token counter
-- KEYS[1]: resource lock key
-- KEYS[2]: monotonic counter key
-- ARGV[1]: lock value (uuid)
-- ARGV[2]: ttl ms

local lock_key = KEYS[1]
local counter_key = KEYS[2]
local lock_val = ARGV[1]
local ttl = tonumber(ARGV[2])

local acquired = redis.call('SET', lock_key, lock_val, 'NX', 'PX', ttl)
if acquired then
    local fencing_token = redis.call('INCR', counter_key)
    return {1, fencing_token}
else
    return {0, 0}
end
