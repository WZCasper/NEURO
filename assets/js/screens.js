/* NEURO — витрина скриншотов программы (.screens). Один слайд виден
   всегда, остальные скрыты через display:none, чтобы не грузить
   невидимые большие изображения раньше времени браузер всё равно
   запросит их за счёт <img src>, поэтому сами файлы уже сжаты в WebP.
   Работает на любой странице программы, где есть .screens-stage —
   если блока нет, скрипт ничего не делает. */
(function () {
  "use strict";

  document.querySelectorAll(".screens-stage").forEach(function (stage) {
    var slides = Array.prototype.slice.call(stage.querySelectorAll(".screens-slide"));
    if (slides.length === 0) return;

    var dotsWrap = stage.parentElement.querySelector(".screens-dots");
    var prevBtn = stage.querySelector(".screens-nav.prev");
    var nextBtn = stage.querySelector(".screens-nav.next");
    var caption = stage.parentElement.querySelector(".screens-caption");
    var current = 0;

    var dots = [];
    if (dotsWrap && slides.length > 1) {
      slides.forEach(function (slide, idx) {
        var dot = document.createElement("button");
        dot.type = "button";
        dot.setAttribute("aria-label", "Показать скриншот " + (idx + 1) + " из " + slides.length);
        dot.addEventListener("click", function () { show(idx); });
        dotsWrap.appendChild(dot);
        dots.push(dot);
      });
    }

    function show(index) {
      index = (index + slides.length) % slides.length;
      slides[current].classList.remove("is-active");
      if (dots[current]) dots[current].classList.remove("is-active");
      current = index;
      slides[current].classList.add("is-active");
      if (dots[current]) dots[current].classList.add("is-active");
      var img = slides[current].querySelector("img");
      if (caption && img) caption.textContent = img.getAttribute("alt") || "";
    }

    if (prevBtn) prevBtn.addEventListener("click", function () { show(current - 1); });
    if (nextBtn) nextBtn.addEventListener("click", function () { show(current + 1); });

    if (slides.length <= 1) {
      if (prevBtn) prevBtn.style.display = "none";
      if (nextBtn) nextBtn.style.display = "none";
    } else {
      stage.setAttribute("tabindex", "0");
      stage.addEventListener("keydown", function (e) {
        if (e.key === "ArrowLeft") { show(current - 1); e.preventDefault(); }
        if (e.key === "ArrowRight") { show(current + 1); e.preventDefault(); }
      });
    }

    show(0);
  });
})();
