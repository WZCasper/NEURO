/* NEURO — общие скрипты сайта: год в футере, меню разработчика/соцсетей,
   мобильное меню, курсор-свечение, 3D-наклон карточек, нейросеть на canvas.
   Файл используется на всех страницах сайта, поэтому каждый блок проверяет,
   что нужные элементы вообще есть на странице, прежде чем с ними работать. */
(function () {
  "use strict";

  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------------- год в футере ---------------- */
  document.querySelectorAll("[data-year]").forEach(function (el) {
    el.textContent = new Date().getFullYear();
  });

  /* ---------------- мобильное меню ---------------- */
  var navToggle = document.querySelector(".nav-toggle");
  var navLinks = document.querySelector(".nav-links");
  if (navToggle && navLinks) {
    navToggle.addEventListener("click", function () {
      var open = navLinks.classList.toggle("open");
      navToggle.setAttribute("aria-expanded", open ? "true" : "false");
    });
    navLinks.querySelectorAll("a").forEach(function (a) {
      a.addEventListener("click", function () { navLinks.classList.remove("open"); });
    });
  }

  /* ---------------- модальное окно «Разработчик / Мои соцсети» ---------------- */
  var devBtn = document.getElementById("dev-btn");
  var devModal = document.getElementById("dev-modal");
  var devModalClose = document.getElementById("dev-modal-close");
  var devModalOverlay = document.getElementById("dev-modal-overlay");

  if (devBtn && devModal) {
    function openModal() {
      devModal.classList.add("is-open");
      document.body.style.overflow = "hidden";
    }
    function closeModal() {
      devModal.classList.remove("is-open");
      document.body.style.overflow = "";
    }
    devBtn.addEventListener("click", function (e) {
      e.preventDefault();
      openModal();
    });
    if (devModalClose) devModalClose.addEventListener("click", closeModal);
    if (devModalOverlay) devModalOverlay.addEventListener("click", closeModal);
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") closeModal();
    });
  }

  /* ---------------- курсор-свечение ---------------- */
  var cursor = document.getElementById("cursor-glow");
  var canHover = window.matchMedia("(hover: hover)").matches;
  if (cursor && canHover && !reduceMotion) {
    document.addEventListener("mousemove", function (e) {
      cursor.style.transform = "translate(" + e.clientX + "px, " + e.clientY + "px)";
    });
  }

  /* ---------------- 3D-наклон карточек ---------------- */
  if (canHover && !reduceMotion) {
    document.querySelectorAll(".app-card").forEach(function (card) {
      card.addEventListener("mousemove", function (e) {
        var rect = card.getBoundingClientRect();
        var x = e.clientX - rect.left;
        var y = e.clientY - rect.top;
        var cx = rect.width / 2, cy = rect.height / 2;
        var rotateX = ((y - cy) / cy) * -10;
        var rotateY = ((x - cx) / cx) * 10;
        card.style.transform = "perspective(1000px) rotateX(" + rotateX.toFixed(2) + "deg) rotateY(" + rotateY.toFixed(2) + "deg) scale3d(1.02,1.02,1.02)";
      });
      card.addEventListener("mouseleave", function () {
        card.style.transform = "perspective(1000px) rotateX(0deg) rotateY(0deg) scale3d(1,1,1)";
      });
    });
  }

  /* ---------------- нейросеть-частицы на canvas ---------------- */
  var canvas = document.getElementById("neuro-canvas");
  if (canvas && canvas.getContext) {
    var ctx = canvas.getContext("2d");
    var particles = [];
    var particleCount = window.innerWidth < 700 ? 55 : 100;
    var connectionDistance = 150;
    var mouseAttractDistance = 200;
    var canvasMouseX = window.innerWidth / 2, canvasMouseY = window.innerHeight / 2;

    function resizeCanvas() {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    }
    window.addEventListener("resize", resizeCanvas);
    resizeCanvas();

    if (canHover) {
      window.addEventListener("mousemove", function (e) {
        canvasMouseX = e.clientX;
        canvasMouseY = e.clientY;
      });
    }

    function Particle() {
      this.x = Math.random() * canvas.width;
      this.y = Math.random() * canvas.height;
      this.vx = (Math.random() - 0.5) * 0.8;
      this.vy = (Math.random() - 0.5) * 0.8;
      this.radius = Math.random() * 2 + 1;
      var colors = ["#7c5cff", "#33e6d8", "#ff4fc3"];
      this.color = colors[Math.floor(Math.random() * colors.length)];
    }
    Particle.prototype.update = function () {
      this.x += this.vx;
      this.y += this.vy;
      if (this.x < 0 || this.x > canvas.width) this.vx *= -1;
      if (this.y < 0 || this.y > canvas.height) this.vy *= -1;

      var dx = canvasMouseX - this.x, dy = canvasMouseY - this.y;
      var dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < mouseAttractDistance && dist > 0) {
        var fx = dx / dist, fy = dy / dist;
        var force = (mouseAttractDistance - dist) / mouseAttractDistance;
        this.vx += fx * force * 0.02;
        this.vy += fy * force * 0.02;
        var speed = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
        if (speed > 2) { this.vx = (this.vx / speed) * 2; this.vy = (this.vy / speed) * 2; }
      }
    };
    Particle.prototype.draw = function () {
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
      ctx.fillStyle = this.color;
      ctx.fill();
    };

    for (var i = 0; i < particleCount; i++) particles.push(new Particle());

    function hexToRgba(hex, alpha) {
      var r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
      return "rgba(" + r + "," + g + "," + b + "," + alpha + ")";
    }

    function drawFrame() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (var a = 0; a < particles.length; a++) {
        particles[a].update();
        particles[a].draw();
        for (var b = a + 1; b < particles.length; b++) {
          var dx = particles[a].x - particles[b].x, dy = particles[a].y - particles[b].y;
          var dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < connectionDistance) {
            var opacity = 1 - dist / connectionDistance;
            var grad = ctx.createLinearGradient(particles[a].x, particles[a].y, particles[b].x, particles[b].y);
            grad.addColorStop(0, hexToRgba(particles[a].color, opacity * 0.5));
            grad.addColorStop(1, hexToRgba(particles[b].color, opacity * 0.5));
            ctx.strokeStyle = grad;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(particles[a].x, particles[a].y);
            ctx.lineTo(particles[b].x, particles[b].y);
            ctx.stroke();
          }
        }
      }
    }

    if (reduceMotion) {
      drawFrame(); // один статичный кадр вместо непрерывной анимации
    } else {
      (function animate() { drawFrame(); requestAnimationFrame(animate); })();
    }
  }
})();
