function toggleMenu() {
  const menu = document.querySelector("nav.mobile");
  const overlay = document.getElementById("mobile-overlay");

  menu.classList.toggle("open");
  document.body.classList.toggle("menu-open");
}


  document.addEventListener("DOMContentLoaded", () => {
  const btnFechar = document.querySelector(".fechar-menu");
  const menu = document.querySelector("nav.mobile");

  btnFechar.addEventListener("click", () => {
    menu.classList.remove("open");
    document.body.classList.remove("menu-open");
  });

  // Também pode fechar clicando no overlay:
  const overlay = document.getElementById("mobile-overlay");
  overlay.addEventListener("click", () => {
    menu.classList.remove("open");
    document.body.classList.remove("menu-open");
  });
});

