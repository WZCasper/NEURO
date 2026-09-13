/* NEURO — site interactions: nav, neural background, tilt, cursor glow */
(function () {
  "use strict";

  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------------- mobile nav ---------------- */
  var toggle = document.querySelector(".nav-toggle");
  var links = document.querySelector(".nav-links");
  if (toggle && links) {
    toggle.addEventListener("click", function () {
      var open = links.classList.toggle("open");
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
    });
    links.querySelectorAll("a").forEach(function (a) {
      a.addEventListener("click", function () { links.classList.remove("open"); });
    });
  }

  /* ---------------- footer year ---------------- */
  document.querySelectorAll("[data-year]").forEach(function (el) {
    el.textContent = new Date().getFullYear();
  });

  /* ---------------- card 3D tilt ---------------- */
  var canHover = window.matchMedia("(hover: hover)").matches;
  if (canHover && !reduceMotion) {
    document.querySelectorAll(".app-card").forEach(function (card) {
      var rect;
      card.addEventListener("pointerenter", function () { rect = card.getBoundingClientRect(); });
      card.addEventListener("pointermove", function (e) {
        if (!rect) rect = card.getBoundingClientRect();
        var px = (e.clientX - rect.left) / rect.width - 0.5;
        var py = (e.clientY - rect.top) / rect.height - 0.5;
        card.style.transform =
          "perspective(900px) rotateX(" + (py * -7).toFixed(2) + "deg) rotateY(" + (px * 9).toFixed(2) + "deg) translateZ(0)";
      });
      card.addEventListener("pointerleave", function () {
        card.style.transform = "perspective(900px) rotateX(0deg) rotateY(0deg)";
      });
    });
  }

  /* ---------------- cursor glow ---------------- */
  var glow = document.getElementById("cursor-glow");
  if (glow && canHover && !reduceMotion) {
    var gx = window.innerWidth / 2, gy = window.innerHeight / 2, cx = gx, cy = gy;
    window.addEventListener("pointermove", function (e) { gx = e.clientX; gy = e.clientY; });
    (function loop() {
      cx += (gx - cx) * 0.12;
      cy += (gy - cy) * 0.12;
      glow.style.transform = "translate(" + cx + "px," + cy + "px) translate(-50%,-50%)";
      requestAnimationFrame(loop);
    })();
  }

  /* ---------------- neural network canvas ---------------- */
  var canvas = document.getElementById("neuro-canvas");
  if (canvas && canvas.getContext) {
    var ctx = canvas.getContext("2d");
    var w, h, dpr = Math.min(window.devicePixelRatio || 1, 2);
    var nodes = [];
    var NODE_COUNT = window.innerWidth < 700 ? 34 : 60;
    var LINK_DIST = 150;
    var mouse = { x: null, y: null };
    var parallax = { x: 0, y: 0 };

    function resize() {
      w = canvas.clientWidth;
      h = canvas.clientHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function makeNodes() {
      nodes = [];
      for (var i = 0; i < NODE_COUNT; i++) {
        var z = Math.random(); // 0 = far, 1 = near -> depth
        nodes.push({
          x: Math.random() * w,
          y: Math.random() * h,
          z: z,
          vx: (Math.random() - 0.5) * (0.12 + z * 0.18),
          vy: (Math.random() - 0.5) * (0.12 + z * 0.18),
          r: 1.1 + z * 2.1
        });
      }
    }

    resize();
    makeNodes();
    window.addEventListener("resize", function () { resize(); makeNodes(); });

    window.addEventListener("pointermove", function (e) {
      var rect = canvas.getBoundingClientRect();
      mouse.x = e.clientX - rect.left;
      mouse.y = e.clientY - rect.top;
      parallax.x = (mouse.x / rect.width - 0.5) * 18;
      parallax.y = (mouse.y / rect.height - 0.5) * 18;
    });
    window.addEventListener("pointerleave", function () { mouse.x = null; mouse.y = null; });

    var hue = 250; // violet base, drifts slowly

    function tick() {
      ctx.clearRect(0, 0, w, h);
      hue += 0.045;
      if (hue > 360) hue -= 360;

      for (var i = 0; i < nodes.length; i++) {
        var n = nodes[i];
        n.x += n.vx + parallax.x * 0.0025 * n.z;
        n.y += n.vy + parallax.y * 0.0025 * n.z;
        if (n.x < -20) n.x = w + 20; if (n.x > w + 20) n.x = -20;
        if (n.y < -20) n.y = h + 20; if (n.y > h + 20) n.y = -20;
      }

      for (var a = 0; a < nodes.length; a++) {
        for (var b = a + 1; b < nodes.length; b++) {
          var dx = nodes[a].x - nodes[b].x, dy = nodes[a].y - nodes[b].y;
          var dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < LINK_DIST) {
            var alpha = (1 - dist / LINK_DIST) * 0.5 * ((nodes[a].z + nodes[b].z) / 2);
            ctx.strokeStyle = "hsla(" + (hue + 60) + ",90%,70%," + alpha.toFixed(3) + ")";
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(nodes[a].x, nodes[a].y);
            ctx.lineTo(nodes[b].x, nodes[b].y);
            ctx.stroke();
          }
        }
      }

      for (var j = 0; j < nodes.length; j++) {
        var node = nodes[j];
        var nodeHue = hue + node.z * 120;
        ctx.beginPath();
        ctx.arc(node.x, node.y, node.r, 0, Math.PI * 2);
        ctx.fillStyle = "hsla(" + nodeHue + ",95%,72%," + (0.35 + node.z * 0.5).toFixed(3) + ")";
        ctx.shadowBlur = 8 * node.z;
        ctx.shadowColor = "hsla(" + nodeHue + ",95%,70%,0.9)";
        ctx.fill();
      }
      ctx.shadowBlur = 0;

      if (!reduceMotion) requestAnimationFrame(tick);
    }

    if (reduceMotion) {
      tick(); // draw a single static frame, no animation loop
    } else {
      requestAnimationFrame(tick);
    }
  }
})();
