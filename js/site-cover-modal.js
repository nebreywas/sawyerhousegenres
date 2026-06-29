/** Lightbox for song cover art on song detail pages. */
(function () {
  const modal = document.getElementById("cover-modal");
  const modalImg = document.getElementById("cover-modal-img");
  const closeBtn = document.querySelector(".cover-modal-close");

  if (!modal || !modalImg) return;

  const openModal = (src, title) => {
    modalImg.src = src;
    modalImg.alt = title ? `${title} cover art` : "Cover art";
    modal.classList.remove("hidden");
    document.body.classList.add("modal-open");
  };

  const closeModal = () => {
    modal.classList.add("hidden");
    modalImg.removeAttribute("src");
    document.body.classList.remove("modal-open");
  };

  document.querySelectorAll(".song-cover-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const src = btn.getAttribute("data-cover-src");
      const title = btn.getAttribute("data-cover-title") || "";
      if (src) openModal(src, title);
    });
  });

  closeBtn?.addEventListener("click", closeModal);
  modal.addEventListener("click", (e) => {
    if (e.target === modal) closeModal();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !modal.classList.contains("hidden")) closeModal();
  });
})();
