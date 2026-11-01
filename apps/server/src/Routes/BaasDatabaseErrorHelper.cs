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
                "42883" => $"عملگر یا تابع مورد نظر تعریف نشده است: {pex.MessageText}",
                "22P02" => $"فرمت داده ارسالی نامعتبر است: {pex.MessageText}",
                "42703" => $"ستون درخواستی در ساختار جدول وجود ندارد: {pex.MessageText}",
                "23505" => $"تداخل کلید یکتا: رکوردی با این مقادیر قبلاً ثبت شده است. ({pex.Detail ?? pex.MessageText})",
                "23503" => $"خطای ارجاع کلید خارجی: رکورد مرتبط در جدول مرجع یافت نشد. ({pex.Detail ?? pex.MessageText})",
                "23502" => $"فیلد اجباری مقداردهی نشده است: {pex.ColumnName ?? pex.MessageText}",
                "23514" => $"قاعده اعتبارسنجی محدودیت نقض گردید: {pex.MessageText}",
                "42P01" => $"جدول درخواستی یافت نشد: {pex.MessageText}",
                "55P03" => "منبع درخواستی در حال حاضر به دلیل تراکنش موازی قفل می‌باشد.",
                _ => $"خطای پایگاه داده: {pex.MessageText}"
            };

            var statusCode = pex.SqlState switch
            {
                "23505" => 409,
                "23503" => 409,
                "42P01" => 404,
                "55P03" => 503,
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

        if (ex is ArgumentException or InvalidOperationException)
        {
            return Results.Json(new
            {
                success = false,
                error = ex.Message,
                code = "BAD_REQUEST",
                detail = ex.Message
            }, statusCode: 400);
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
