document.addEventListener('DOMContentLoaded', () => {
  const mainGrid = document.getElementById('main-grid');
  const siteSidebar = document.getElementById('site-sidebar');
  const siteNav = document.getElementById('site-nav');
  const menuToggle = document.getElementById('menu-toggle');
  const sidebarOverlay = document.getElementById('sidebar-overlay');
  const siteNavEnabled = document.body?.dataset?.siteNavigation === 'true';
  const siteNavTitle = document.getElementById('site-nav-title');

  if (!siteNavEnabled || !mainGrid || !siteSidebar || !siteNav) return;

  if (menuToggle && sidebarOverlay) {
    const toggleMenu = () => {
      const isOpen = siteSidebar.classList.contains('open');
      if (isOpen) {
        siteSidebar.classList.remove('open');
        menuToggle.classList.remove('active');
        sidebarOverlay.classList.remove('active');
        document.body.style.overflow = '';
      } else {
        siteSidebar.classList.add('open');
        menuToggle.classList.add('active');
        sidebarOverlay.classList.add('active');
        document.body.style.overflow = 'hidden';
      }
    };

    menuToggle.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleMenu();
    });

    sidebarOverlay.addEventListener('click', toggleMenu);

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && siteSidebar.classList.contains('open')) {
        toggleMenu();
      }
    });
  }

  const buildSitemapCandidates = () => {
    const pathname = window.location.pathname || '/';
    const segments = pathname.split('/').filter(Boolean);
    const candidates = [];
    for (let i = segments.length; i >= 0; i -= 1) {
      const prefix = i === 0 ? '' : `/${segments.slice(0, i).join('/')}`;
      const candidate = prefix === '' ? '/sitemap.json' : `${prefix}/sitemap.json`;
      candidates.push(candidate);
    }
    return Array.from(new Set(candidates));
  };

  const fetchSitemap = async () => {
    const candidates = buildSitemapCandidates();
    for (const candidate of candidates) {
      try {
        const response = await fetch(candidate);
        if (!response.ok) {
          continue;
        }
        const data = await response.json();
        const urlPath = new URL(response.url).pathname;
        const basePath = urlPath.endsWith('/sitemap.json')
          ? urlPath.slice(0, -'/sitemap.json'.length)
          : '';
        return { data, basePath };
      } catch (error) {
        continue;
      }
    }
    return null;
  };

  const normalizePath = (value) => {
    if (!value) return '/';
    if (value === '/') return '/';
    return value.startsWith('/') ? value : `/${value}`;
  };

  const createNavList = (node, basePath, currentPath, alternatePath, depth = 0) => {
    const list = document.createElement('ul');
    list.className = depth === 0 ? 'site-nav-menu' : 'site-nav-submenu';

    (node.children || []).forEach((child) => {
      const li = document.createElement('li');
      li.className = 'site-nav-item';

      const isPage = Boolean(child.createdAt);

      if (isPage) {
        const link = document.createElement('a');
        const href = `${basePath}${child.relative_path}`;
        link.href = href || '/';
        link.textContent = child.title || child.relative_path;
        link.className = 'site-nav-link';
        if (href === currentPath || href === alternatePath) {
          link.classList.add('active');
        }
        li.appendChild(link);
      } else {
        const label = document.createElement('div');
        label.className = 'site-nav-section';
        label.textContent = child.title || child.relative_path;
        li.appendChild(label);
      }

      if (child.children && child.children.length > 0) {
        li.appendChild(
          createNavList(child, basePath, currentPath, alternatePath, depth + 1)
        );
      }

      list.appendChild(li);
    });

    return list;
  };

  const initSiteNav = async () => {
    const sitemap = await fetchSitemap();
    if (!sitemap || !sitemap.data) return;

    const basePath = sitemap.basePath || '';
    const currentPath = normalizePath(window.location.pathname || '/');
    const alternatePath = currentPath.endsWith('/') && currentPath !== '/'
      ? currentPath.slice(0, -1)
      : `${currentPath}/`;

    mainGrid.classList.add('has-sidenav');

    const rootHref = `${basePath}${sitemap.data.relative_path || '/'}` || '/';
    if (siteNavTitle && sitemap.data?.createdAt) {
      const link = document.createElement('a');
      link.href = rootHref;
      link.textContent = sitemap.data.title || 'Home';
      link.className = 'site-nav-title-link';
      siteNavTitle.textContent = '';
      siteNavTitle.appendChild(link);
    }

    const navList = createNavList(
      sitemap.data,
      basePath,
      currentPath,
      alternatePath
    );
    siteNav.appendChild(navList);
  };

  initSiteNav();
});

document.addEventListener('DOMContentLoaded', () => {
  const article = document.querySelector('main.article');
  const tocNav = document.getElementById('toc-nav');
  const mainGrid = document.getElementById('main-grid');

  if (!article || !tocNav || !mainGrid) return;

  const headers = Array.from(article.querySelectorAll('h2, h3'));
  if (headers.length === 0) return;

  const isContentsHeader = (header) => {
    const text = (header.textContent || '')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
    const id = (header.id || '').toLowerCase();
    return (
      text === 'contents' ||
      text === 'table of contents' ||
      id === 'contents' ||
      id === 'table-of-contents'
    );
  };

  const contentsHeader = headers.find(isContentsHeader);
  if (!contentsHeader) return;

  const contentHeaders = headers.filter((header) => header !== contentsHeader);
  if (contentHeaders.length === 0) return;

  mainGrid.classList.add('has-sidebar');
  contentsHeader.classList.add('hide-on-desktop');

  const nextEl = contentsHeader.nextElementSibling;
  if (nextEl && (nextEl.tagName === 'UL' || nextEl.tagName === 'OL')) {
    nextEl.classList.add('hide-on-desktop');
  }

  const ul = document.createElement('ul');
  ul.className = 'toc-menu';

  let currentH2Li = null;
  let currentSubMenu = null;

  contentHeaders.forEach((header) => {
    if (!header.id) {
      header.id = header.textContent.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    }

    const li = document.createElement('li');
    li.className = 'toc-item';

    const a = document.createElement('a');
    a.href = '#' + header.id;
    a.innerText = header.textContent.trim();
    a.className = 'toc-link';

    li.appendChild(a);

    if (header.tagName === 'H2') {
      ul.appendChild(li);
      currentH2Li = li;
      currentSubMenu = null;
    } else if (header.tagName === 'H3' && currentH2Li) {
      if (!currentSubMenu) {
        currentSubMenu = document.createElement('ul');
        currentSubMenu.className = 'toc-sub-menu';
        currentH2Li.appendChild(currentSubMenu);
      }
      currentSubMenu.appendChild(li);
    } else {
      ul.appendChild(li);
    }
  });

  tocNav.appendChild(ul);

  const onScroll = () => {
    let current = '';
    const scrollPos = window.scrollY;

    for (const section of contentHeaders) {
      const sectionTop = section.offsetTop;
      if (scrollPos >= sectionTop - 150) {
        current = section.getAttribute('id');
      }
    }

    if (window.innerHeight + window.scrollY >= document.body.offsetHeight - 50) {
      current = contentHeaders[contentHeaders.length - 1].getAttribute('id');
    }

    document.querySelectorAll('.toc-sidebar .toc-link').forEach((link) => {
      link.classList.remove('active');
      if (link.getAttribute('href') === '#' + current) {
        link.classList.add('active');
      }
    });
  };

  window.addEventListener('scroll', onScroll);
  onScroll();
});

document.addEventListener('DOMContentLoaded', () => {
  const lightboxOverlay = document.createElement('div');
  lightboxOverlay.className = 'lightbox-overlay';
  lightboxOverlay.innerHTML = `
    <span class="lightbox-close">&times;</span>
    <img class="lightbox-image" src="" alt="Lightbox Image">
  `;
  document.body.appendChild(lightboxOverlay);

  const lightboxImage = lightboxOverlay.querySelector('.lightbox-image');
  const lightboxClose = lightboxOverlay.querySelector('.lightbox-close');
  const articleImages = document.querySelectorAll('main.article img');

  articleImages.forEach((img) => {
    if (!img.hasAttribute('loading')) {
      img.setAttribute('loading', 'lazy');
    }
    if (!img.hasAttribute('decoding')) {
      img.setAttribute('decoding', 'async');
    }
  });

  const openLightbox = (src) => {
    lightboxImage.src = src;
    lightboxOverlay.classList.add('active');
    document.body.style.overflow = 'hidden';
  };

  const closeLightbox = () => {
    lightboxOverlay.classList.remove('active');
    document.body.style.overflow = '';
    setTimeout(() => {
      lightboxImage.src = '';
    }, 300);
  };

  articleImages.forEach((img) => {
    img.addEventListener('click', (event) => {
      event.stopPropagation();
      openLightbox(img.src);
    });
  });

  lightboxClose.addEventListener('click', closeLightbox);
  lightboxOverlay.addEventListener('click', (event) => {
    if (event.target === lightboxOverlay) {
      closeLightbox();
    }
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && lightboxOverlay.classList.contains('active')) {
      closeLightbox();
    }
  });
});
