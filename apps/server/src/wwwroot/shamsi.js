// LocalMe Shamsi (Solar Hijri / Jalali) Date Engine & Interactive Datepicker Widget
(function (global) {
  'use strict';

  // 1. Gregorian to Jalali conversion algorithms
  function gregorianToJalali(gy, gm, gd) {
    const g_d_m = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
    let jy = (gy <= 1600) ? 0 : 979;
    gy -= (gy <= 1600) ? 621 : 1600;
    const gy2 = (gm > 2) ? (gy + 1) : gy;
    let days = (365 * gy) + Math.floor((gy2 + 3) / 4) - Math.floor((gy2 + 99) / 100)
      + Math.floor((gy2 + 399) / 400) - 80 + gd + g_d_m[gm - 1];
    jy += 33 * Math.floor(days / 12053);
    days %= 12053;
    jy += 4 * Math.floor(days / 1461);
    days %= 1461;
    jy += Math.floor((days - 1) / 365);
    if (days > 0) days = (days - 1) % 365;
    let jm, jd;
    if (days < 186) {
      jm = 1 + Math.floor(days / 31);
      jd = 1 + (days % 31);
    } else {
      jm = 7 + Math.floor((days - 186) / 30);
      jd = 1 + ((days - 186) % 30);
    }
    return [jy, jm, jd];
  }

  function jalaliToGregorian(jy, jm, jd) {
    let gy = (jy <= 979) ? 621 : 1600;
    jy -= (jy <= 979) ? 0 : 979;
    let days = (365 * jy) + Math.floor(jy / 33) * 8 + Math.floor(((jy % 33) + 3) / 4)
      + 78 + jd + ((jm < 7) ? (jm - 1) * 31 : ((jm - 7) * 30) + 186);
    gy += 400 * Math.floor(days / 146097);
    days %= 146097;
    if (days > 36524) {
      gy += 100 * Math.floor(--days / 36524);
      days %= 36524;
      if (days >= 365) days++;
    }
    gy += 4 * Math.floor(days / 1461);
    days %= 1461;
    gy += Math.floor((days - 1) / 365);
    if (days > 0) days = (days - 1) % 365;
    let gd = days + 1;
    const sal_a = [0, 31, ((gy % 4 === 0 && gy % 100 !== 0) || (gy % 400 === 0)) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    let gm;
    for (gm = 0; gm < 13; gm++) {
      const v = sal_a[gm];
      if (gd <= v) break;
      gd -= v;
    }
    return [gy, gm, gd];
  }

  const persianDigits = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
  const jalaliMonthNames = [
    'فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور',
    'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند'
  ];

  function toPersianDigits(str) {
    if (str === null || str === undefined) return '';
    return String(str).replace(/[0-9]/g, w => persianDigits[+w]);
  }

  function formatShamsiDate(dateObj) {
    const d = (dateObj instanceof Date) ? dateObj : new Date(dateObj);
    if (isNaN(d.getTime())) return '-';
    const [jy, jm, jd] = gregorianToJalali(d.getFullYear(), d.getMonth() + 1, d.getDate());
    const pad = n => n < 10 ? '0' + n : String(n);
    const dateStr = `${jy}/${pad(jm)}/${pad(jd)}`;
    const timeStr = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
    return `${toPersianDigits(dateStr)} - ${toPersianDigits(timeStr)}`;
  }

  function formatShamsiShort(dateObj) {
    const d = (dateObj instanceof Date) ? dateObj : new Date(dateObj);
    if (isNaN(d.getTime())) return '-';
    const [jy, jm, jd] = gregorianToJalali(d.getFullYear(), d.getMonth() + 1, d.getDate());
    return `${toPersianDigits(jd)} ${jalaliMonthNames[jm - 1]} ${toPersianDigits(jy)}`;
  }

  function formatToman(irr) {
    const toman = Math.floor((irr || 0) / 10);
    return `${toPersianDigits(toman.toLocaleString('en-US'))} تومان`;
  }

  function formatRial(irr) {
    return `${toPersianDigits((irr || 0).toLocaleString('en-US'))} ریال`;
  }

  // 2. Interactive Shamsi Datepicker Popover Component
  class ShamsiDatepicker {
    constructor(containerId, options = {}) {
      this.container = typeof containerId === 'string' ? document.getElementById(containerId) : containerId;
      this.onSelect = typeof options === 'function' ? options : (options && options.onSelect) || (() => {});
      const now = new Date();
      const [jy, jm, jd] = gregorianToJalali(now.getFullYear(), now.getMonth() + 1, now.getDate());
      this.currentYear = jy;
      this.currentMonth = jm;
      this.selectedDate = { year: jy, month: jm, day: jd };
      this.render();
    }

    render() {
      if (!this.container) return;

      let monthDays = 30;
      if (this.currentMonth <= 6) {
        monthDays = 31;
      } else if (this.currentMonth <= 11) {
        monthDays = 30;
      } else {
        const isLeap = [1, 5, 9, 13, 17, 22, 26, 30].includes(this.currentYear % 33);
        monthDays = isLeap ? 30 : 29;
      }

      // Calculate weekday of the 1st of this Shamsi month
      const [gy, gm, gd] = jalaliToGregorian(this.currentYear, this.currentMonth, 1);
      const gDate = new Date(gy, gm - 1, gd);
      // gDate.getDay(): 0=Sun, 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat
      // Persian week: Saturday=0, Sunday=1, ..., Friday=6
      const weekdayOffset = (gDate.getDay() + 1) % 7;

      const emptyCells = Array.from({ length: weekdayOffset }, () => '<span class="shamsi-dp-empty"></span>').join('');
      const dayCells = Array.from({ length: monthDays }, (_, i) => {
        const day = i + 1;
        const isSelected = this.selectedDate.year === this.currentYear &&
                           this.selectedDate.month === this.currentMonth &&
                           this.selectedDate.day === day;
        return `<button type="button" class="shamsi-dp-day ${isSelected ? 'active' : ''}" data-day="${day}">${toPersianDigits(day)}</button>`;
      }).join('');
      
      this.container.innerHTML = `
        <div class="shamsi-datepicker-card">
          <div class="shamsi-dp-header">
            <button type="button" class="shamsi-dp-nav-btn" id="shamsi-prev-month">« ماه قبل</button>
            <div class="shamsi-dp-title">${jalaliMonthNames[this.currentMonth - 1]} ${toPersianDigits(this.currentYear)}</div>
            <button type="button" class="shamsi-dp-nav-btn" id="shamsi-next-month">ماه بعد »</button>
          </div>
          <div class="shamsi-dp-weekdays">
            <span>ش</span><span>ی</span><span>د</span><span>س</span><span>چ</span><span>پ</span><span>ج</span>
          </div>
          <div class="shamsi-dp-grid">
            ${emptyCells}
            ${dayCells}
          </div>
          <div class="shamsi-dp-footer">
            <span style="font-size: 13px; color: #64748b;">تاریخ فیلتر: ${toPersianDigits(this.selectedDate.year)}/${toPersianDigits(this.selectedDate.month)}/${toPersianDigits(this.selectedDate.day)}</span>
            <button type="button" class="btn-cf-primary" style="padding: 4px 10px; font-size: 13px;" id="shamsi-apply-btn">اعمال فیلتر</button>
          </div>
        </div>
      `;

      this.container.querySelector('#shamsi-prev-month').addEventListener('click', (e) => {
        e.stopPropagation();
        if (this.currentMonth > 1) {
          this.currentMonth--;
        } else {
          this.currentMonth = 12;
          this.currentYear--;
        }
        this.render();
      });

      this.container.querySelector('#shamsi-next-month').addEventListener('click', (e) => {
        e.stopPropagation();
        if (this.currentMonth < 12) {
          this.currentMonth++;
        } else {
          this.currentMonth = 1;
          this.currentYear++;
        }
        this.render();
      });

      this.container.querySelectorAll('.shamsi-dp-day').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const day = parseInt(btn.dataset.day, 10);
          this.selectedDate = { year: this.currentYear, month: this.currentMonth, day };
          this.render();
        });
      });

      this.container.querySelector('#shamsi-apply-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        this.onSelect(this.selectedDate);
      });
    }
  }

  global.ShamsiDatepicker = ShamsiDatepicker;
  global.Shamsi = {
    gregorianToJalali,
    jalaliToGregorian,
    toPersianDigits,
    formatDate: formatShamsiDate,
    formatShort: formatShamsiShort,
    formatToman,
    formatRial,
    Datepicker: ShamsiDatepicker
  };
})(window);
