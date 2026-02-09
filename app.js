// Same repo: index.json and preset files are served from the same origin as the page
var INDEX_JSON_URL = './index.json';
// Use relative URL so fetch is same-origin (no CORS). Works on GitHub Pages and local.
var RAW_BASE = '';
var THEME_STORAGE_KEY = 'polymaker-preset-theme';

function applyTheme(theme) {
  var body = document.body;
  if (theme === 'wiki') {
    body.classList.add('theme-wiki');
  } else {
    body.classList.remove('theme-wiki');
    theme = 'dark';
  }
  var btn = document.getElementById('theme-toggle');
  if (btn) {
    btn.setAttribute('data-theme', theme);
  }
}

function initTheme() {
  var initial = 'dark';
  try {
    var params = new URLSearchParams(window.location.search || '');
    var fromUrl = params.get('theme');
    if (fromUrl === 'wiki' || fromUrl === 'dark') {
      initial = fromUrl;
    } else {
      var stored = window.localStorage ? window.localStorage.getItem(THEME_STORAGE_KEY) : null;
      if (stored === 'wiki' || stored === 'dark') {
        initial = stored;
      }
    }
  } catch (e) {
    // ignore URL/localStorage errors, fallback to default
  }

  applyTheme(initial);

  var btn = document.getElementById('theme-toggle');
  if (btn) {
    btn.addEventListener('click', function () {
      var next = document.body.classList.contains('theme-wiki') ? 'dark' : 'wiki';
      applyTheme(next);
      try {
        if (window.localStorage) {
          window.localStorage.setItem(THEME_STORAGE_KEY, next);
        }
      } catch (e) {
        // ignore
      }
    });
  }
}

function init() {
  var tbody = document.getElementById('tbody');
  var status = document.getElementById('status');
  var filterState = {
    series: '',
    material: '',
    brand: '',
    model: '',
    slicer: ''
  };

  // Material series for filtering: Panchroma / Polymaker / Fiberon / PolyTerra / PolyLite
  var MATERIAL_SERIES = ['Panchroma', 'Polymaker', 'Fiberon', 'PolyTerra', 'PolyLite'];

  initTheme();

  fetch(INDEX_JSON_URL)
    .then(function (r) { return r.json(); })
    .then(function (data) {
      var materials = data.materials || [];
      var brands = data.brands || [];
      var models = data.models || [];
      var slicers = data.slicers || [];
      var presets = data.presets || [];

      function escapeHtml(s) {
        var div = document.createElement('div');
        div.textContent = s;
        return div.innerHTML;
      }

      function setupDropdown(name, list) {
        var dropdown = document.querySelector('.dropdown[data-filter="' + name + '"]');
        if (!dropdown) return;
        var toggle = dropdown.querySelector('.dropdown-toggle');
        var labelEl = dropdown.querySelector('.dropdown-label');
        var menu = dropdown.querySelector('.dropdown-menu');

        function renderOptions(options) {
          var html = [
            '<div class="dropdown-option is-active" data-value="">All</div>'
          ].concat(options.map(function (x) {
            return '<div class="dropdown-option" data-value="' + escapeHtml(x) + '">' +
              escapeHtml(x) +
              '</div>';
          }));
          menu.innerHTML = html.join('');
          filterState[name] = '';
          if (labelEl) labelEl.textContent = 'All';
        }

        renderOptions(list || []);

        toggle.addEventListener('click', function (e) {
          e.stopPropagation();
          var isOpen = dropdown.classList.contains('is-open');
          closeAllDropdowns();
          if (!isOpen) {
            dropdown.classList.add('is-open');
          }
        });

        menu.addEventListener('click', function (e) {
          var option = e.target.closest('.dropdown-option');
          if (!option) return;
          var value = option.getAttribute('data-value') || '';
          var text = option.textContent || '';
          filterState[name] = value;

          var prevActive = menu.querySelector('.dropdown-option.is-active');
          if (prevActive) prevActive.classList.remove('is-active');
          option.classList.add('is-active');

          if (labelEl) labelEl.textContent = text || 'All';
          dropdown.classList.remove('is-open');
          render();
        });
      }

      function closeAllDropdowns() {
        var open = document.querySelectorAll('.dropdown.is-open');
        for (var i = 0; i < open.length; i++) {
          open[i].classList.remove('is-open');
        }
      }

      document.addEventListener('click', function (e) {
        if (!e.target.closest('.dropdown')) {
          closeAllDropdowns();
        }
      });

      setupDropdown('series', MATERIAL_SERIES);
      setupDropdown('material', materials);
      setupDropdown('brand', brands);
      setupDropdown('model', models);
      setupDropdown('slicer', slicers);

      /** Return presets matching current filters except the given dimension (for building "has result" option lists). */
      function getMatchingPresets(exceptFilter) {
        return presets.filter(function (p) {
          if (exceptFilter !== 'series' && filterState.series && (p.material || '').indexOf(filterState.series + ' ') !== 0) return false;
          if (exceptFilter !== 'material' && filterState.material && p.material !== filterState.material) return false;
          if (exceptFilter !== 'brand' && filterState.brand && p.brand !== filterState.brand) return false;
          if (exceptFilter !== 'model' && filterState.model && p.model !== filterState.model) return false;
          if (exceptFilter !== 'slicer' && filterState.slicer && p.slicer !== filterState.slicer) return false;
          return true;
        });
      }

      function updateDropdownOptions(name, list) {
        var current = filterState[name];
        var inList = list.indexOf(current) !== -1;
        if (current && !inList) filterState[name] = '';
        var display = inList ? current : '';
        var dropdown = document.querySelector('.dropdown[data-filter="' + name + '"]');
        if (!dropdown) return;
        var menu = dropdown.querySelector('.dropdown-menu');
        var labelEl = dropdown.querySelector('.dropdown-label');
        var html = [
          '<div class="dropdown-option' + (display ? '' : ' is-active') + '" data-value="">All</div>'
        ].concat(list.map(function (x) {
          var active = x === display ? ' is-active' : '';
          return '<div class="dropdown-option' + active + '" data-value="' + escapeHtml(x) + '">' + escapeHtml(x) + '</div>';
        }));
        menu.innerHTML = html.join('');
        if (labelEl) labelEl.textContent = display || 'All';
      }

      /** Only show filter options that have at least one preset to avoid zero-result combinations. */
      function updateAllFilterOptions() {
        var matchSeries = getMatchingPresets('series');
        var seriesList = MATERIAL_SERIES.filter(function (s) {
          return matchSeries.some(function (p) { return (p.material || '').indexOf(s + ' ') === 0; });
        });
        updateDropdownOptions('series', seriesList);

        var matchMaterial = getMatchingPresets('material');
        var materialList = [];
        var seenMat = {};
        matchMaterial.forEach(function (p) {
          var m = p.material || '';
          if (!seenMat[m]) { seenMat[m] = true; materialList.push(m); }
        });
        materialList.sort();
        updateDropdownOptions('material', materialList);

        var matchBrand = getMatchingPresets('brand');
        var brandList = [];
        var seenBrand = {};
        matchBrand.forEach(function (p) {
          var b = p.brand || '';
          if (!seenBrand[b]) { seenBrand[b] = true; brandList.push(b); }
        });
        brandList.sort();
        updateDropdownOptions('brand', brandList);

        var matchModel = getMatchingPresets('model');
        var modelList = [];
        var seenModel = {};
        matchModel.forEach(function (p) {
          var m = p.model || '';
          if (!seenModel[m]) { seenModel[m] = true; modelList.push(m); }
        });
        modelList.sort();
        updateDropdownOptions('model', modelList);

        var matchSlicer = getMatchingPresets('slicer');
        var slicerList = [];
        var seenSlicer = {};
        matchSlicer.forEach(function (p) {
          var s = p.slicer || '';
          if (!seenSlicer[s]) { seenSlicer[s] = true; slicerList.push(s); }
        });
        slicerList.sort();
        updateDropdownOptions('slicer', slicerList);
      }

      function render() {
        updateAllFilterOptions();
        var series = filterState.series;
        var material = filterState.material;
        var brand = filterState.brand;
        var model = filterState.model;
        var slicer = filterState.slicer;
        var filtered = presets.filter(function (p) {
          if (series && (p.material || '').indexOf(series + ' ') !== 0) return false;
          if (material && p.material !== material) return false;
          if (brand && p.brand !== brand) return false;
          if (model && p.model !== model) return false;
          if (slicer && p.slicer !== slicer) return false;
          return true;
        });

        // Group by material; when one material has multiple presets, show one row with a dropdown
        var groups = {};
        filtered.forEach(function (p) {
          var key = p.material || '';
          if (!groups[key]) groups[key] = [];
          groups[key].push(p);
        });

        var base = (typeof RAW_BASE === 'string' && RAW_BASE !== null) ? RAW_BASE : (RAW_BASE || '');
        var rowsHtml = [];
        var totalPresets = 0;
        function displayFilename(filename, slicer) {
          var fn = filename || 'preset.json';
          var ext = fn.replace(/^.*\./, '') || 'json';
          var baseName = fn.replace(/\.[^.]+$/, '') || 'preset';
          return slicer ? (baseName + ' - ' + slicer + '.' + ext) : fn;
        }
        for (var mat in groups) {
          var list = groups[mat];
          totalPresets += list.length;
          var first = list[0];
          var url0 = first.path ? (base + encodeURI(first.path)) : '#';
          var filename0 = displayFilename(first.filename, first.slicer);
          var zipName0 = (filename0.replace(/\.[^.]+$/, '') || 'preset') + '.zip';

          if (list.length > 1) {
            var firstLabel = (first.brand || '') + ' ' + (first.model || '') + ' ' + (first.slicer || '');
            firstLabel = firstLabel.trim();
            var optionsHtml = list.map(function (p, i) {
              var label = (p.brand || '') + ' ' + (p.model || '') + ' ' + (p.slicer || '');
              label = label.trim();
              var activeClass = i === 0 ? ' is-active' : '';
              var optFilename = displayFilename(p.filename, p.slicer);
              return '<div class="dropdown-option' + activeClass + '" data-path="' + escapeHtml(p.path || '') + '" data-filename="' + escapeHtml(optFilename) + '" data-slicer="' + escapeHtml(p.slicer || '') + '">' + escapeHtml(label) + '</div>';
            }).join('');
            rowsHtml.push('<tr>' +
              '<td>' + escapeHtml(mat) + '</td>' +
              '<td><div class="dropdown preset-row-dropdown"><button class="dropdown-toggle" type="button" aria-label="Choose preset"><span class="dropdown-label">' + escapeHtml(firstLabel) + '</span><span class="dropdown-arrow" aria-hidden="true"></span></button><div class="dropdown-menu">' + optionsHtml + '</div></div></td>' +
              '<td class="td-actions"><a href="' + url0 + '" class="btn-download" data-download-url="' + escapeHtml(url0) + '" data-download-filename="' + escapeHtml(filename0) + '" role="button" title="Download as JSON file">JSON</a> <a href="#" class="btn-download-zip-row" data-download-url="' + escapeHtml(url0) + '" data-download-filename="' + escapeHtml(filename0) + '" data-download-zipname="' + escapeHtml(zipName0) + '" role="button" title="Download as ZIP file">ZIP</a></td>' +
              '</tr>');
          } else {
            var presetLabel = (first.brand || '') + ' ' + (first.model || '') + ' ' + (first.slicer || '');
            rowsHtml.push('<tr>' +
              '<td>' + escapeHtml(mat) + '</td>' +
              '<td>' + escapeHtml(presetLabel.trim()) + '</td>' +
              '<td class="td-actions"><a href="' + url0 + '" class="btn-download" data-download-url="' + escapeHtml(url0) + '" data-download-filename="' + escapeHtml(filename0) + '" role="button" title="Download as JSON file">JSON</a> <a href="#" class="btn-download-zip-row" data-download-url="' + escapeHtml(url0) + '" data-download-filename="' + escapeHtml(filename0) + '" data-download-zipname="' + escapeHtml(zipName0) + '" role="button" title="Download as ZIP file">ZIP</a></td>' +
              '</tr>');
          }
        }

        tbody.innerHTML = rowsHtml.join('');

        status.textContent = totalPresets + ' presets in ' + Object.keys(groups).length + ' materials.';
      }

      tbody.addEventListener('click', function (e) {
        // Row preset dropdown: on option click, select and update JSON + ZIP links, then close
        var rowOpt = e.target.closest('.preset-row-dropdown .dropdown-option');
        if (rowOpt) {
          e.preventDefault();
          var path = rowOpt.getAttribute('data-path') || '';
          var filename = rowOpt.getAttribute('data-filename') || 'preset.json';
          var row = rowOpt.closest('tr');
          var dropdown = rowOpt.closest('.preset-row-dropdown');
          var labelEl = dropdown.querySelector('.dropdown-label');
          if (labelEl) labelEl.textContent = rowOpt.textContent;
          dropdown.querySelectorAll('.dropdown-option').forEach(function (o) { o.classList.remove('is-active'); });
          rowOpt.classList.add('is-active');
          var u = (typeof RAW_BASE === 'string' && RAW_BASE !== null) ? RAW_BASE : (RAW_BASE || '');
          var fullUrl = path ? (u + encodeURI(path)) : '#';
          var zipName = (filename.replace(/\.[^.]+$/, '') || 'preset') + '.zip';
          var jsonBtn = row ? row.querySelector('a.btn-download') : null;
          var zipBtn = row ? row.querySelector('a.btn-download-zip-row') : null;
          if (jsonBtn) {
            jsonBtn.setAttribute('data-download-url', fullUrl);
            jsonBtn.setAttribute('data-download-filename', filename);
            jsonBtn.setAttribute('href', fullUrl);
            jsonBtn.setAttribute('title', 'Download as JSON file');
          }
          if (zipBtn) {
            zipBtn.setAttribute('data-download-url', fullUrl);
            zipBtn.setAttribute('data-download-filename', filename);
            zipBtn.setAttribute('data-download-zipname', zipName);
            zipBtn.setAttribute('title', 'Download as ZIP file');
          }
          dropdown.classList.remove('is-open');
          return;
        }
        // Row preset dropdown: on toggle click, close others and toggle this one
        var rowToggle = e.target.closest('.preset-row-dropdown .dropdown-toggle');
        if (rowToggle) {
          e.preventDefault();
          closeAllDropdowns();
          var dd = rowToggle.closest('.preset-row-dropdown');
          dd.classList.toggle('is-open');
          return;
        }
        // Download as ZIP (one preset per row)
        var zipLink = e.target.closest('a.btn-download-zip-row');
        if (zipLink && typeof JSZip !== 'undefined') {
          e.preventDefault();
          var url = zipLink.getAttribute('data-download-url');
          var filename = zipLink.getAttribute('data-download-filename') || 'preset.json';
          var zipName = zipLink.getAttribute('data-download-zipname') || 'preset.zip';
          if (!url || url === '#') return;
          zipLink.setAttribute('aria-busy', 'true');
          fetch(url, { mode: 'cors' })
            .then(function (r) { return r.blob(); })
            .then(function (blob) {
              var zip = new JSZip();
              zip.file(filename, blob);
              return zip.generateAsync({ type: 'blob' });
            })
            .then(function (zipBlob) {
              var a = document.createElement('a');
              a.href = URL.createObjectURL(zipBlob);
              a.download = zipName;
              document.body.appendChild(a);
              a.click();
              document.body.removeChild(a);
              URL.revokeObjectURL(a.href);
            })
            .catch(function (err) {
              window.open(url, '_blank', 'noopener');
            })
            .then(function () {
              zipLink.removeAttribute('aria-busy');
            });
          return;
        }
        // Download as JSON (single file)
        var link = e.target.closest('a.btn-download');
        if (!link) return;
        var url = link.getAttribute('data-download-url');
        var filename = link.getAttribute('data-download-filename');
        if (!url || url === '#') return;
        e.preventDefault();
        fetch(url, { mode: 'cors' })
          .then(function (r) { return r.blob(); })
          .then(function (blob) {
            var objectUrl = URL.createObjectURL(blob);
            var a = document.createElement('a');
            a.href = objectUrl;
            a.download = filename || 'preset.json';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(objectUrl);
          })
          .catch(function () {
            window.open(url, '_blank', 'noopener');
          });
      });

      render();
    })
    .catch(function (err) {
      document.getElementById('status').textContent = 'Failed to load: ' + err.message;
    });
}

// Modal functionality for Manual Installation
function initModal() {
  var modal = document.getElementById('install-modal');
  var helpBtn = document.getElementById('help-btn');
  var closeBtn = modal.querySelector('.modal-close');
  var overlay = modal.querySelector('.modal-overlay');

  function openModal() {
    modal.setAttribute('aria-hidden', 'false');
    modal.classList.add('is-open');
    document.body.style.overflow = 'hidden';
  }

  function closeModal() {
    modal.setAttribute('aria-hidden', 'true');
    modal.classList.remove('is-open');
    document.body.style.overflow = '';
  }

  if (helpBtn) {
    helpBtn.addEventListener('click', openModal);
  }

  if (closeBtn) {
    closeBtn.addEventListener('click', closeModal);
  }

  if (overlay) {
    overlay.addEventListener('click', closeModal);
  }

  // Close on Escape key
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape' && modal.classList.contains('is-open')) {
      closeModal();
    }
  });
}

// Tooltip positioning to prevent clipping
init();
initModal();
