(function () {
  var show = document.querySelector('.slideshow');
  if (!show) return;

  var slides = Array.prototype.slice.call(show.querySelectorAll('.slide'));
  var dots = Array.prototype.slice.call(show.querySelectorAll('.dot'));
  var prevBtn = show.querySelector('.nav-arrow.prev');
  var nextBtn = show.querySelector('.nav-arrow.next');
  var current = 0;

  function render() {
    slides.forEach(function (s, i) { s.classList.toggle('is-active', i === current); });
    dots.forEach(function (d, i) {
      d.classList.toggle('is-active', i === current);
      d.setAttribute('aria-current', i === current ? 'true' : 'false');
    });
  }

  function go(i) {
    current = (i + slides.length) % slides.length;
    render();
  }

  if (prevBtn) prevBtn.addEventListener('click', function () { go(current - 1); });
  if (nextBtn) nextBtn.addEventListener('click', function () { go(current + 1); });
  dots.forEach(function (d, i) { d.addEventListener('click', function () { go(i); }); });

  window.addEventListener('keydown', function (e) {
    if (e.key === 'ArrowLeft') go(current - 1);
    if (e.key === 'ArrowRight') go(current + 1);
  });

  render();
})();
