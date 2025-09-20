// clock.js - ساعة عادية + ساعة زوال (نظام 12 ساعة للعقارب + نظام 24 ساعة للعرض الرقمي)

'use strict';

// ⚠️ نفترض أن prayerTimes موجودة مسبقًا (مصفوفة ثابتة)

// 🕐 تحويل HH.MM إلى دقائق
function h2m(hm) {
  return Math.floor(hm) * 60 + Math.ceil((hm - Math.floor(hm)) * 100);
}

// 📆 حساب يوم السنة
function dayOfYear(date) {
  const oneDay = 1000 * 60 * 60 * 24;
  return Math.floor((date - new Date(date.getFullYear(), 0, 0)) / oneDay);
}

// 🌅 حساب وقت الشروق والغروب
function getSunTimes(now) {
  const dayOfYearIndex = dayOfYear(now) - 1;

  const sunriseMinutes = h2m(prayerTimes[dayOfYearIndex][1]);
  const sunsetMinutes = h2m(prayerTimes[dayOfYearIndex][4] + 12);

  const sunriseTime = new Date();
  const sunsetTime = new Date();

  const srH = Math.floor(sunriseMinutes / 60);
  const srM = sunriseMinutes % 60;
  sunriseTime.setHours(srH, srM, 0, 0);

  const ssH = Math.floor(sunsetMinutes / 60);
  const ssM = sunsetMinutes % 60;
  sunsetTime.setHours(ssH, ssM, 0, 0);

  return { sunriseTime, sunsetTime };
}

// 🌅 حساب التوقيت الزوالي بنظام 12 ساعة (للعقارب) + نظام 24 ساعة (للعرض الرقمي)
function calculateSolarTime(now) {
  const { sunriseTime, sunsetTime } = getSunTimes(now);
  const nowTime = now.getTime();

  // ⏱️ طول النهار والليل بالثواني
  const daylightSeconds = (sunsetTime.getTime() - sunriseTime.getTime()) / 1000;
  const nightSeconds = (24 * 60 * 60) - daylightSeconds;

  // 🕰️ حساب وقت غروب الأمس
  const previousSunset = new Date(sunsetTime);
  previousSunset.setDate(previousSunset.getDate() - 1);

  // 🌙 الليل: من الغروب → الشروق — 12 ساعة زوالية — نظام 24: 0–11
  if (nowTime >= sunsetTime.getTime() || nowTime < sunriseTime.getTime()) {
    let elapsedSeconds;
    if (nowTime > sunsetTime.getTime()) {
      elapsedSeconds = (nowTime - sunsetTime.getTime()) / 1000;
    } else {
      elapsedSeconds = (nowTime - previousSunset.getTime()) / 1000 + (24 * 60 * 60 - nightSeconds);
    }

    const solarHourSeconds = nightSeconds / 12;
    const hour12 = Math.floor(elapsedSeconds / solarHourSeconds) + 1; // 1-12
    const totalHour24 = Math.floor(elapsedSeconds / solarHourSeconds) % 12; // 0-11

    const remainingSeconds = elapsedSeconds % solarHourSeconds;
    const minute = Math.floor(remainingSeconds / 60);
    const second = Math.floor(remainingSeconds % 60);

    return {
      period: 'night',
      hour12,
      minute,
      second,
      totalHour24
    };
  }

  // 🌞 النهار: من الشروق → الغروب — 12 ساعة زوالية — نظام 24: 12–23
  else {
    const elapsedSeconds = (nowTime - sunriseTime.getTime()) / 1000;
    const solarHourSeconds = daylightSeconds / 12;

    const hour12 = Math.floor(elapsedSeconds / solarHourSeconds) + 1; // 1-12
    const totalHour24 = 12 + (Math.floor(elapsedSeconds / solarHourSeconds) % 12); // 12-23

    const remainingSeconds = elapsedSeconds % solarHourSeconds;
    const minute = Math.floor(remainingSeconds / 60);
    const second = Math.floor(remainingSeconds % 60);

    return {
      period: 'day',
      hour12,
      minute,
      second,
      totalHour24
    };
  }
}

// 🎨 1. رسم الدائرة الخلفية + علامات الساعات
function drawFace(ctx, radius) {
  // رسم الدائرة البيضاء الخلفية
  ctx.beginPath();
  ctx.arc(0, 0, radius, 0, 2 * Math.PI);
  ctx.fillStyle = "#fff";
  ctx.fill();

  // رسم النقطة المركزية
  ctx.beginPath();
  ctx.arc(0, 0, radius * 0.05, 0, 2 * Math.PI);
  ctx.fillStyle = "#000";
  ctx.fill();

  // رسم علامات الساعات (12 علامة)
  ctx.font = radius * 0.15 + "px Arial";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#000";

  for (let num = 1; num <= 12; num++) {
    const angle = num * Math.PI / 6; // 30 درجة لكل ساعة
    const xOuter = Math.sin(angle) * (radius - radius * 0.03);  // نهاية العلامة
    const yOuter = -Math.cos(angle) * (radius - radius * 0.03);
    const xInner = Math.sin(angle) * (radius - radius * 0.15);  // بداية العلامة
    const yInner = -Math.cos(angle) * (radius - radius * 0.15);

    // رسم علامة الساعة (خط)
    ctx.beginPath();
    ctx.moveTo(xInner, yInner);
    ctx.lineTo(xOuter, yOuter);
    ctx.lineWidth = 3;
    ctx.strokeStyle = "#000";
    ctx.stroke();

    // رسم رقم الساعة
    const xText = Math.sin(angle) * (radius - radius * 0.25);
    const yText = -Math.cos(angle) * (radius - radius * 0.25);
    ctx.fillText(num.toString(), xText, yText);
  }
}

// 🎨 2. رسم عقرب الساعات (يدعم العادية والزوال)
function drawHourHand(ctx, hour, radius, isSolar = false) {
  let angle;
  if (isSolar) {
    // ساعة زوال: 1–12 → نطرح 1 لتحويلها إلى 0–11
    angle = ((hour - 1) / 12) * 2 * Math.PI;
  } else {
    // ساعة عادية: 0–23 → نأخذ باقي القسمة على 12
    angle = ((hour % 12) / 12) * 2 * Math.PI;
  }
  ctx.strokeStyle = "#00008B";
  ctx.lineWidth = radius * 0.07;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(Math.sin(angle) * radius * 0.5, -Math.cos(angle) * radius * 0.5);
  ctx.stroke();
}

// 🎨 3. رسم عقرب الدقائق
function drawMinuteHand(ctx, minute, radius) {
  const angle = (minute / 60) * 2 * Math.PI;
  ctx.strokeStyle = "#808080";
  ctx.lineWidth = radius * 0.05;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(Math.sin(angle) * radius * 0.8, -Math.cos(angle) * radius * 0.8);
  ctx.stroke();
}

// 🎨 4. رسم عقرب الثواني
function drawSecondHand(ctx, second, radius) {
  const angle = (second / 60) * 2 * Math.PI;
  ctx.strokeStyle = "#FF0000";
  ctx.lineWidth = 2;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(Math.sin(angle) * radius * 0.9, -Math.cos(angle) * radius * 0.9);
  ctx.stroke();
}

// 🎨 5. رسم الساعة كاملة (الوجه + العقارب) حسب التوقيت المعطى
function drawClock(container, hours, minutes, seconds, isSolar = false, solarData = null) {
  // 🔹 أولاً: إنشاء أو تحديث العناصر
  let canvas = container.querySelector('canvas');
  let digitalDisplay = container.querySelector('.digital-display');

  if (!canvas) {
    canvas = document.createElement('canvas');
    canvas.width = 300;
    canvas.height = 300;
    container.appendChild(canvas);
  }

  if (!digitalDisplay) {
    digitalDisplay = document.createElement('div');
    digitalDisplay.className = 'digital-display';
    digitalDisplay.style.fontSize = '1.2rem';
    digitalDisplay.style.marginTop = '10px';
    digitalDisplay.style.fontFamily = 'monospace';
    digitalDisplay.style.textAlign = 'center';
    container.appendChild(digitalDisplay);
  }

  // 🎨 تحديث التوقيت الرقمي
  if (isSolar && solarData) {
    const planetNames = ['زحل', 'المشتري', 'المريخ', 'الشمس', 'الزهرة', 'عطارد', 'القمر'];
    const dayOfWeekPlanet = [3, 6, 2, 5, 1, 4, 0];
    const now = new Date();
    const dayOfWeek = now.getDay();
    const planetIndex = (dayOfWeekPlanet[dayOfWeek] + solarData.hour12 - 1) % 7;
    const planetName = planetNames[planetIndex];

    digitalDisplay.innerHTML = `
      <div>${solarData.period === 'day' ? '🌞 النهار' : '🌙 الليل'} | ${planetName}</div>
      <div>${String(solarData.hour12 - 1).padStart(2, '0')}:${String(solarData.minute).padStart(2, '0')}:${String(solarData.second).padStart(2, '0')}</div>
      <div style="font-size: 1rem; color: #aaa;">${String(solarData.totalHour24).padStart(2, '0')}:${String(solarData.minute).padStart(2, '0')}:${String(solarData.second).padStart(2, '0')}</div>
    `;
  } else {
    digitalDisplay.textContent = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }

  // 🎨 رسم الساعة التماثلية
  const ctx = canvas.getContext("2d");
  const radius = canvas.height / 2;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.save();
  ctx.translate(radius, radius);

  // 1. رسم الدائرة الخلفية + علامات الساعات
  drawFace(ctx, radius);

  // 2-4. رسم العقارب
  if (isSolar && solarData) {
    drawHourHand(ctx, solarData.hour12, radius, true); // نظام 12 ساعة للزوال
  } else {
    drawHourHand(ctx, hours, radius, false); // نظام 24 ساعة للعادي — ✅ لا نضيف +1
  }
  drawMinuteHand(ctx, minutes, radius);
  drawSecondHand(ctx, seconds, radius);

  ctx.restore();
}

// 🔄 إجراء يعمل كل ثانية
function updateClocks() {
  const now = new Date();
  const hours = now.getHours();
  const minutes = now.getMinutes();
  const seconds = now.getSeconds();

  // 🕰️ رسم الساعة العادية
  const normalContainer = document.getElementById('normal-clock-container');
  if (normalContainer) {
    drawClock(normalContainer, hours, minutes, seconds, false);
  }

  // 🌅 رسم الساعة الزوالية (نظام 12 ساعة للعقارب + 24 للعرض الرقمي)
  const solarTime = calculateSolarTime(now);
  const solarContainer = document.getElementById('solar-clock-container');
  if (solarContainer && solarTime) {
    drawClock(solarContainer, solarTime.hour12, solarTime.minute, solarTime.second, true, solarTime);
  }
}

// 🚀 تشغيل عند تحميل الصفحة
document.addEventListener('DOMContentLoaded', function() {
  // تحديث كل ثانية
  updateClocks(); // أول مرة
  setInterval(updateClocks, 1000); // ثم كل ثانية
});