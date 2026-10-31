namespace LocalMe.Server.Routes;

using System;
using Microsoft.AspNetCore.Http;

public static class BaasDatabaseErrorHelper
{
    public static IResult FormatDbError(Exception ex)
    {
        if (ex is Npgsql.PostgresException pex)
        {
            var userMsg = pex.SqlState switch
            {
                "42804" => $"عدم تطابق نوع داده: {pex.MessageText}",
                "42703" => $"ستون درخواستی در ساختار جدول وجود ندارد: {pex.MessageText}",
                "23505" => $"تداخل کلید یکتا: رکوردی با این مقادیر قبلاً ثبت شده است. ({pex.Detail ?? pex.MessageText})",
                "23503" => $"خطای ارجاع کلید خارجی: رکورد مرتبط در جدول مرجع یافت نشد. ({pex.Detail ?? pex.MessageText})",
                "23502" => $"فیلد اجباری مقداردهی نشده است: {pex.ColumnName ?? pex.MessageText}",
                "23514" => $"قاعده اعتبارسنجی محدودیت نقض گردید: {pex.MessageText}",
                "42P01" => $"جدول درخواستی یافت نشد: {pex.MessageText}",
                _ => $"خطای پایگاه داده: {pex.MessageText}"
            };

            var statusCode = pex.SqlState switch
            {
                "23505" => 409,
                "42P01" => 404,
                _ => 400
            };

            return Results.Json(new
            {
                success = false,
                error = userMsg,
                code = pex.SqlState,
                detail = pex.Detail ?? pex.MessageText
            }, statusCode: statusCode);
        }

        return Results.Json(new
        {
            success = false,
            error = "خطای پردازش عملیات پایگاه داده.",
            code = "INTERNAL_SERVER_ERROR",
            detail = ex.Message
        }, statusCode: 500);
    }
}
