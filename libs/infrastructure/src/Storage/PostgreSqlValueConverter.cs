namespace LocalMe.Infrastructure.Storage;

using System;
using System.Globalization;
using System.Text.Json;
using System.Text.Json.Nodes;
using Npgsql;
using NpgsqlTypes;

/// <summary>
/// High-performance, zero-allocation data converter for PostgreSQL and JSON serialization.
/// Guarantees that PostgreSQL native types (bool, bigint, jsonb, timestamptz, uuid)
/// map faithfully to JSON primitives without string-flattening or type mismatch.
/// </summary>
public static class PostgreSqlValueConverter
{
    public static JsonNode? ReadTypedValue(NpgsqlDataReader reader, int ordinal)
    {
        if (reader.IsDBNull(ordinal))
        {
            return null;
        }

        var dataTypeName = reader.GetDataTypeName(ordinal).ToLowerInvariant();

        // Check for JSON / JSONB columns first
        if (dataTypeName is "json" or "jsonb")
        {
            var rawJson = reader.GetString(ordinal);
            try
            {
                return JsonNode.Parse(rawJson);
            }
            catch
            {
                return JsonValue.Create(rawJson);
            }
        }

        var fieldType = reader.GetFieldType(ordinal);

        if (fieldType == typeof(bool))
        {
            return JsonValue.Create(reader.GetBoolean(ordinal));
        }

        if (fieldType == typeof(short))
        {
            return JsonValue.Create(reader.GetInt16(ordinal));
        }

        if (fieldType == typeof(int))
        {
            return JsonValue.Create(reader.GetInt32(ordinal));
        }

        if (fieldType == typeof(long))
        {
            return JsonValue.Create(reader.GetInt64(ordinal));
        }

        if (fieldType == typeof(float))
        {
            return JsonValue.Create(reader.GetFloat(ordinal));
        }

        if (fieldType == typeof(double))
        {
            return JsonValue.Create(reader.GetDouble(ordinal));
        }

        if (fieldType == typeof(decimal))
        {
            return JsonValue.Create(reader.GetDecimal(ordinal));
        }

        if (fieldType == typeof(Guid))
        {
            return JsonValue.Create(reader.GetGuid(ordinal).ToString());
        }

        if (fieldType == typeof(DateTime))
        {
            var dt = reader.GetDateTime(ordinal);
            return JsonValue.Create(dt.Kind == DateTimeKind.Unspecified
                ? DateTime.SpecifyKind(dt, DateTimeKind.Utc).ToString("O")
                : dt.ToUniversalTime().ToString("O"));
        }

        if (fieldType == typeof(DateTimeOffset))
        {
            return JsonValue.Create(reader.GetFieldValue<DateTimeOffset>(ordinal).ToUniversalTime().ToString("O"));
        }

        if (fieldType == typeof(byte[]))
        {
            var bytes = (byte[])reader.GetValue(ordinal);
            return JsonValue.Create(Convert.ToBase64String(bytes));
        }

        var val = reader.GetValue(ordinal);
        return JsonValue.Create(val?.ToString());
    }

    public static object CoerceParameterValue(object? rawValue, string? expectedDataType)
    {
        if (rawValue == null)
        {
            return DBNull.Value;
        }

        // Unwrap JsonNode if needed
        if (rawValue is JsonValue jVal)
        {
            if (jVal.TryGetValue<bool>(out var b)) return b;
            if (jVal.TryGetValue<long>(out var l)) return l;
            if (jVal.TryGetValue<double>(out var d)) return d;
            if (jVal.TryGetValue<string>(out var s)) rawValue = s;
            else rawValue = jVal.ToString();
        }
        else if (rawValue is JsonObject or JsonArray)
        {
            return rawValue.ToString() ?? "{}";
        }

        var valStr = rawValue.ToString();
        if (string.IsNullOrEmpty(expectedDataType))
        {
            return rawValue;
        }

        var dt = expectedDataType.ToLowerInvariant();

        if (dt.Contains("jsonb") || dt.Contains("json"))
        {
            return valStr ?? "null";
        }

        if (dt.Contains("bool"))
        {
            if (rawValue is bool booleanVal) return booleanVal;
            if (bool.TryParse(valStr, out var parsedBool)) return parsedBool;
            if (valStr == "1") return true;
            if (valStr == "0") return false;
            return false;
        }

        if (dt.Contains("smallint") || dt.Contains("int2"))
        {
            if (rawValue is short s) return s;
            if (short.TryParse(valStr, NumberStyles.Integer, CultureInfo.InvariantCulture, out var parsedShort)) return parsedShort;
            return rawValue;
        }

        if (dt.Contains("integer") || dt.Contains("int4") || dt == "int" || dt.Contains("serial"))
        {
            if (rawValue is int i) return i;
            if (int.TryParse(valStr, NumberStyles.Integer, CultureInfo.InvariantCulture, out var parsedInt)) return parsedInt;
            return rawValue;
        }

        if (dt.Contains("bigint") || dt.Contains("int8") || dt.Contains("bigserial"))
        {
            if (rawValue is long lg) return lg;
            if (long.TryParse(valStr, NumberStyles.Integer, CultureInfo.InvariantCulture, out var parsedLong)) return parsedLong;
            return rawValue;
        }

        if (dt.Contains("numeric") || dt.Contains("decimal"))
        {
            if (rawValue is decimal dec) return dec;
            if (decimal.TryParse(valStr, NumberStyles.Any, CultureInfo.InvariantCulture, out var parsedDec)) return parsedDec;
            return rawValue;
        }

        if (dt.Contains("real") || dt.Contains("float4"))
        {
            if (rawValue is float fl) return fl;
            if (float.TryParse(valStr, NumberStyles.Any, CultureInfo.InvariantCulture, out var parsedFloat)) return parsedFloat;
            return rawValue;
        }

        if (dt.Contains("double") || dt.Contains("float8"))
        {
            if (rawValue is double dbl) return dbl;
            if (double.TryParse(valStr, NumberStyles.Any, CultureInfo.InvariantCulture, out var parsedDouble)) return parsedDouble;
            return rawValue;
        }

        if (dt.Contains("uuid"))
        {
            if (rawValue is Guid g) return g;
            if (Guid.TryParse(valStr, out var parsedGuid)) return parsedGuid;
            return rawValue;
        }

        if (dt.Contains("timestamp") || dt.Contains("date"))
        {
            if (rawValue is DateTime dtVal) return dtVal.ToUniversalTime();
            if (rawValue is DateTimeOffset dtoVal) return dtoVal.UtcDateTime;
            if (DateTimeOffset.TryParse(valStr, CultureInfo.InvariantCulture, DateTimeStyles.AssumeUniversal, out var parsedDto))
            {
                return parsedDto.UtcDateTime;
            }
            return rawValue;
        }

        return rawValue;
    }

    public static void BindParameter(NpgsqlParameter parameter, object? value, string? dataType = null)
    {
        var coerced = CoerceParameterValue(value, dataType);
        parameter.Value = coerced ?? DBNull.Value;

        if (!string.IsNullOrEmpty(dataType))
        {
            var dt = dataType.ToLowerInvariant();
            if (dt.Contains("jsonb"))
            {
                parameter.NpgsqlDbType = NpgsqlDbType.Jsonb;
            }
            else if (dt.Contains("json"))
            {
                parameter.NpgsqlDbType = NpgsqlDbType.Json;
            }
            else if (dt.Contains("uuid") && coerced is Guid)
            {
                parameter.NpgsqlDbType = NpgsqlDbType.Uuid;
            }
            else if (dt.Contains("bool") && coerced is bool)
            {
                parameter.NpgsqlDbType = NpgsqlDbType.Boolean;
            }
            else if ((dt.Contains("bigint") || dt.Contains("int8")) && coerced is long)
            {
                parameter.NpgsqlDbType = NpgsqlDbType.Bigint;
            }
            else if ((dt.Contains("integer") || dt.Contains("int4")) && coerced is int)
            {
                parameter.NpgsqlDbType = NpgsqlDbType.Integer;
            }
        }
    }
}
