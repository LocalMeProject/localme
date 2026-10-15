-- Generic Cell Rate Algorithm (GCRA) Rate Limiter
-- KEYS[1]: rate limit key
-- ARGV[1]: rate (emissions per interval in ms)
-- ARGV[2]: burst capacity
-- ARGV[3]: now (unix timestamp ms)
-- ARGV[4]: cost (default 1)

local key = KEYS[1]
local rate = tonumber(ARGV[1])
local capacity = tonumber(ARGV[2])
local now = tonumber(ARGV[3])
local cost = tonumber(ARGV[4]) or 1

local emission_interval = rate
local delay_variation_tolerance = emission_interval * capacity

local tat = redis.call('GET', key)
if not tat then
    tat = now
else
    tat = tonumber(tat)
end

tat = math.max(tat, now)
local new_tat = tat + (cost * emission_interval)
local allow_at = new_tat - delay_variation_tolerance

if allow_at <= now then
    redis.call('SET', key, new_tat, 'PX', math.ceil(new_tat - now + emission_interval))
    return {1, 0, math.max(0, math.floor((new_tat - now) / emission_interval))}
else
    local reset_after_ms = math.ceil(allow_at - now)
    return {0, reset_after_ms, 0}
end
