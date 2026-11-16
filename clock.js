/* ============================================================
   Sakura Clock — clock logic
   Updates the three rings, the AM/PM readout and the ticking
   dots once per second, aligned to the wall-clock second.
   ============================================================ */
(function () {
    'use strict';

    // 2 * PI * 70 (ring radius) ~= 439.8, rounded to 440.
    // Must match the stroke-dasharray in style.css.
    var CIRCUMFERENCE = 440;
    var HOURS_PER_RING = 12;
    var MINUTES_PER_RING = 60;
    var SECONDS_PER_RING = 60;

    var DEG_PER_HOUR = 360 / HOURS_PER_RING;      // 30
    var DEG_PER_MINUTE = 360 / MINUTES_PER_RING;  // 6
    var DEG_PER_SECOND = 360 / SECONDS_PER_RING;  // 6

    var timeEl = document.getElementById('time');
    var hoursEl = document.getElementById('hours');
    var minutesEl = document.getElementById('minutes');
    var secondsEl = document.getElementById('seconds');
    var ampmEl = document.getElementById('ampm');

    var hrDot = document.querySelector('.hr_dot');
    var minDot = document.querySelector('.min_dot');
    var secDot = document.querySelector('.sec_dot');

    var hh = document.getElementById('hh');
    var mm = document.getElementById('mm');
    var ss = document.getElementById('ss');

    function pad(n) {
        return (n < 10) ? '0' + n : '' + n;
    }

    function updateClock() {
        var now = new Date();
        var h24 = now.getHours();
        var m = now.getMinutes();
        var s = now.getSeconds();
        var ampm = h24 >= 12 ? 'PM' : 'AM';

        // 12-hour conversion: midnight and noon both read "12".
        var h = h24 % HOURS_PER_RING;
        if (h === 0) {
            h = 12;
        }

        var hLabel = pad(h);
        var mLabel = pad(m);
        var sLabel = pad(s);

        hoursEl.innerHTML = hLabel + '<br><span>Hours</span>';
        minutesEl.innerHTML = mLabel + '<br><span>Minutes</span>';
        secondsEl.innerHTML = sLabel + '<br><span>Seconds</span>';
        ampmEl.textContent = ampm;

        // Fill each ring in proportion to its value:
        // 0 -> empty ring (offset 440), max -> full ring (offset 0).
        hh.style.strokeDashoffset = CIRCUMFERENCE - (CIRCUMFERENCE * h) / HOURS_PER_RING;
        mm.style.strokeDashoffset = CIRCUMFERENCE - (CIRCUMFERENCE * m) / MINUTES_PER_RING;
        ss.style.strokeDashoffset = CIRCUMFERENCE - (CIRCUMFERENCE * s) / SECONDS_PER_RING;

        // Move the dots around the rim.
        hrDot.style.transform = 'rotate(' + (h * DEG_PER_HOUR) + 'deg)';
        minDot.style.transform = 'rotate(' + (m * DEG_PER_MINUTE) + 'deg)';
        secDot.style.transform = 'rotate(' + (s * DEG_PER_SECOND) + 'deg)';

        timeEl.setAttribute(
            'aria-label',
            'Current time: ' + hLabel + ':' + mLabel + ':' + sLabel + ' ' + ampm
        );
    }

    // setTimeout (instead of setInterval) so the tick stays aligned to the
    // wall-clock second and does not drift.
    function scheduleTick() {
        var now = new Date();
        setTimeout(function () {
            updateClock();
            scheduleTick();
        }, 1000 - now.getMilliseconds());
    }

    // Reveal the time on click/tap as well as hover, and make it keyboard
    // operable (the container is focusable, so Enter/Space toggles it).
    function toggleReveal() {
        timeEl.classList.toggle('is-revealed');
    }

    timeEl.addEventListener('click', toggleReveal);
    timeEl.addEventListener('keydown', function (event) {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            toggleReveal();
        }
    });

    updateClock();
    scheduleTick();
})();
