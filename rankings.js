function createPage(ns, pageKey, columns, jsonFile, exportName, opts = {}) {
    const state = Object.assign({
        movies: [],
        filteredMovies: [],
        sortColumn: 0,
        sortDirection: 'asc',
        selectedCountries: [],
        selectedGenres: [],
        selectedDirectors: [],
        selectedStarrings: [],
        selectedRatings: [],
        selectedYears: [],
        selectedVoteCounts: [],
        selectedPlayables: [],
        selectedPlatforms: []
    }, opts.extraState || {});

    function id(name) { return document.getElementById(ns + '-' + name); }

    function toListHtml(val) {
        if (!val || val === '--' || val === '') return '-';
        let items = [];
        if (Array.isArray(val)) {
            items = val.filter(v => v && v.trim());
        } else if (typeof val === 'string') {
            items = val.split(/[\/\s]+/).filter(v => v.trim());
        }
        if (items.length === 0) return '-';
        return '<ul style="margin:0;padding-left:15px;font-size:0.8rem;line-height:1.4;">' +
               items.map(v => `<li>${v}</li>`).join('') + '</ul>';
    }

    function renderCell(key, value, item) {
        switch (key) {
            case 'rank':
                return `<td class="rank">${value}</td>`;
            case 'title': {
                const t = value || '-';
                const link = item.detailLink || '';
                return `<td title="${t}">${link
                    ? `<a href="${link}" target="_blank" class="movie-title-link" title="点击查看详情: ${t}">${t}</a>`
                    : t}</td>`;
            }
            case 'originalTitle':
                return `<td>${value || '-'}</td>`;
            case 'otherTitles': {
                const names = [];
                if (item.originalTitle && item.originalTitle.trim()) names.push(item.originalTitle);
                if (value && typeof value === 'string') {
                    let other = value.trim().replace(/^[\/|\s ]+/, '');
                    other.split(/\s{2,}\/\s{2,}|\s{2,}\|\s{2,}/).map(t => t.trim()).filter(t => t).forEach(t => names.push(t));
                }
                const html = names.length
                    ? '<ul style="margin:0;padding-left:15px;font-size:0.8rem;line-height:1.4;">' + names.map(n => `<li>${n}</li>`).join('') + '</ul>'
                    : '-';
                return `<td>${html}</td>`;
            }
            case 'platforms':
                return `<td>${toListHtml(value)}</td>`;
            case 'rating':
                return `<td class="rating">${value ? Number(value).toFixed(1) : '-'}</td>`;
            case 'voteCount': {
                const v = value;
                return `<td>${v ? (v >= 10000 ? (v / 10000).toFixed(1) + '万' : v) : '-'}</td>`;
            }
            case 'usefulCount':
                return `<td>${value || 0}</td>`;
            case 'director':
                return `<td>${toListHtml(value)}</td>`;
            case 'starring': {
                const actors = value || item.cast || [];
                if (Array.isArray(actors) && actors.length > 0) {
                    return '<td><ul style="margin:0;padding-left:15px;font-size:0.8rem;line-height:1.4;">' +
                           actors.slice(0, 10).map(a => `<li>${a}</li>`).join('') + '</ul></td>';
                }
                return '<td>-</td>';
            }
            case 'year':
                return `<td class="year">${value || '-'}</td>`;
            case 'country':
                return `<td>${toListHtml(value)}</td>`;
            case 'genre':
                return `<td class="genre">${toListHtml(value)}</td>`;
            case 'releaseDates':
                return `<td>${toListHtml(value)}</td>`;
            case 'duration':
            case 'screenwriter':
            case 'language':
            case 'dateWatched':
            case 'datePlayed':
            case 'releaseDate':
                return `<td>${value || '-'}</td>`;
            case 'quote':
            case 'comment': {
                const text = value || '';
                const display = text.length > 20 ? text.substring(0, 20) + '...' : text;
                return `<td class="comment-cell" data-full-text="${text.replace(/"/g, '&quot;')}">${display || '-'}</td>`;
            }
            case 'playable':
                return `<td>${value ? '<span style="color:#00A65F;font-weight:bold;">是</span>' : '-'}</td>`;
            default:
                if (opts.renderCellFn) {
                    const r = opts.renderCellFn(key, value, item);
                    if (r !== undefined) return r;
                }
                return `<td>${value || '-'}</td>`;
        }
    }

    function updateFilterCount(filterId, selectedCount, total) {
        const el = id(filterId.replace('Filter', 'FilterCount'));
        if (!el) return;
        el.textContent = selectedCount > 0 ? `${selectedCount}个已选/${total}` : total;
        el.style.background = selectedCount > 0 ? '#ff6b6b' : '#28a745';
    }

    function renderCheckboxFilter(filterId, data, selected, type) {
        const container = id(filterId);
        if (!container) return;
        const sorted = Object.entries(data).sort((a, b) => b[1] - a[1]);
        container.innerHTML = sorted.map(([name, count]) =>
            `<div class="checkbox-item ${selected.includes(name) ? 'selected' : ''}"
                  onclick="pages['${pageKey}']._toggle('${type}','${name.replace(/'/g, "\\'")}')">
                ${name}<span class="count-badge">${count}</span>
            </div>`
        ).join('');
        updateFilterCount(filterId, selected.length, state.movies.length);
    }

    function renderStaticCheckboxFilter(filterId, data, selected, type) {
        const container = id(filterId);
        if (!container) return;
        container.innerHTML = Object.entries(data).map(([name, count]) =>
            `<div class="checkbox-item ${selected.includes(name) ? 'selected' : ''}"
                  onclick="pages['${pageKey}']._toggle('${type}','${name.replace(/'/g, "\\'")}')">
                ${name}<span class="count-badge">${count}</span>
            </div>`
        ).join('');
        updateFilterCount(filterId, selected.length, state.movies.length);
    }

    function computeCounts(source) {
        if (opts.computeDyn) return opts.computeDyn(source);
        const country = {}, genre = {}, platform = {}, director = {}, starring = {};
        source.forEach(m => {
            const getList = (v, sep) => Array.isArray(v) ? v : (typeof v === 'string' ? v.split(sep).map(s => s.trim()).filter(s => s) : []);
            getList(m.country, ' ').forEach(c => { country[c] = (country[c] || 0) + 1; });
            getList(m.genre, ' ').forEach(g => { genre[g] = (genre[g] || 0) + 1; });
            (Array.isArray(m.platforms) ? m.platforms : (m.platforms || '').split('/').map(s => s.trim()).filter(s => s))
                .forEach(p => { platform[p] = (platform[p] || 0) + 1; });
            getList(m.director, '/').forEach(d => { director[d] = (director[d] || 0) + 1; });
            (m.starring || m.cast || []).filter(a => a && !a.includes('(配音)'))
                .forEach(a => { starring[a.trim()] = (starring[a.trim()] || 0) + 1; });
        });
        return { country, genre, platform, director, starring };
    }

    function buildStaticCounts(source) {
        if (opts.buildStatic) return opts.buildStatic(source);
        const ratingOpts = { '9.5分以上': m => m.rating >= 9.5, '9分以上': m => m.rating >= 9.0, '8.5分以上': m => m.rating >= 8.5, '8分以上': m => m.rating >= 8.0 };
        const yearOpts = { '2020年及以后': m => m.year >= 2020, '2010年及以后': m => m.year >= 2010, '2000年及以后': m => m.year >= 2000, '1990年及以后': m => m.year >= 1990, '1980年及以后': m => m.year >= 1980, '1980年以前': m => m.year < 1980 };
        const voteOpts = { '100万以上': m => (m.voteCount || 0) >= 1000000, '50万以上': m => (m.voteCount || 0) >= 500000, '20万以上': m => (m.voteCount || 0) >= 200000, '10万以上': m => (m.voteCount || 0) >= 100000 };
        const playableOpts = { '仅可播放': m => m.playable === true, '不可播放': m => m.playable !== true };
        const mk = (opts) => Object.fromEntries(Object.entries(opts).map(([k, fn]) => [k, source.filter(fn).length]));
        return { rating: mk(ratingOpts), year: mk(yearOpts), voteCount: mk(voteOpts), playable: mk(playableOpts) };
    }

    function renderAllFilters(source) {
        const dyn = computeCounts(source);
        const stat = buildStaticCounts(source);
        renderCheckboxFilter('countryFilter', dyn.country, state.selectedCountries, 'country');
        renderCheckboxFilter('genreFilter', dyn.genre, state.selectedGenres, 'genre');
        if (id('platformFilter')) renderCheckboxFilter('platformFilter', dyn.platform, state.selectedPlatforms, 'platform');
        renderCheckboxFilter('directorFilter', dyn.director, state.selectedDirectors, 'director');
        renderCheckboxFilter('starringFilter', dyn.starring, state.selectedStarrings, 'starring');
        renderStaticCheckboxFilter('ratingFilter', stat.rating, state.selectedRatings, 'rating');
        renderStaticCheckboxFilter('yearFilter', stat.year, state.selectedYears, 'year');
        if (id('voteCountFilter')) renderStaticCheckboxFilter('voteCountFilter', stat.voteCount, state.selectedVoteCounts, 'voteCount');
        if (id('playableFilter')) renderStaticCheckboxFilter('playableFilter', stat.playable, state.selectedPlayables, 'playable');
        if (opts.renderExtra) opts.renderExtra(state, id, renderCheckboxFilter, renderStaticCheckboxFilter);
    }

    function updateActiveFiltersInfo() {
        const info = id('activeFiltersInfo');
        const text = id('activeFiltersText');
        if (!info || !text) return;
        const search = id('searchTitle')?.value;
        const conds = [];
        if (search) conds.push(`名称含"${search}"`);
        if (state.selectedRatings.length) conds.push('评分:' + state.selectedRatings.join(','));
        if (state.selectedYears.length) conds.push('年份:' + state.selectedYears.join(','));
        if (state.selectedVoteCounts.length) conds.push('评价人数:' + state.selectedVoteCounts.join(','));
        if (state.selectedPlayables.length) conds.push('播放状态:' + state.selectedPlayables.join(','));
        if (state.selectedCountries.length) conds.push('地区:' + state.selectedCountries.join(','));
        if (state.selectedGenres.length) conds.push('类型:' + state.selectedGenres.join(','));
        if (state.selectedPlatforms.length) conds.push('平台:' + state.selectedPlatforms.join(','));
        if (state.selectedDirectors.length) conds.push('导演:' + state.selectedDirectors.join(','));
        if (state.selectedStarrings.length) conds.push('主演:' + state.selectedStarrings.join(','));
        if (state.selectedCriticScores?.length) conds.push('媒体评分:' + state.selectedCriticScores.join(','));
        if (state.selectedUserScores?.length) conds.push('用户评分:' + state.selectedUserScores.join(','));
        if (state.selectedSentiments?.length) conds.push('口碑:' + state.selectedSentiments.join(','));
        if (state.selectedEsrbs?.length) conds.push('ESRB:' + state.selectedEsrbs.join(','));
        if (conds.length) {
            info.style.display = 'block';
            text.innerHTML = conds.join(' | ') + `<span class="clear-filter" onclick="pages['${pageKey}'].resetFilters()">清除所有</span>`;
        } else {
            info.style.display = 'none';
        }
    }

    function updateStats() {
        const el = name => id(name);
        if (el('totalCount')) el('totalCount').textContent = state.movies.length;
        if (el('filteredCount')) el('filteredCount').textContent = state.filteredMovies.length;
        if (el('titleCount')) el('titleCount').textContent = state.filteredMovies.length;
        if (opts.statsExtra) {
            const extra = opts.statsExtra(state.filteredMovies);
            if (extra.avgRating !== undefined && el('avgRating')) el('avgRating').textContent = extra.avgRating;
            if (extra.yearRange !== undefined && el('yearRange')) el('yearRange').textContent = extra.yearRange;
        } else {
            const ratingKey = opts.extraState?.selectedCriticScores !== undefined ? 'criticScore' : 'rating';
            const ratings = state.filteredMovies.map(m => m[ratingKey]).filter(r => r != null && r !== '');
            if (el('avgRating')) el('avgRating').textContent = ratings.length ? (ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(2) : '-';
            const years = state.filteredMovies.map(m => m.year).filter(y => y);
            if (el('yearRange')) el('yearRange').textContent = years.length ? Math.min(...years) + '-' + Math.max(...years) : '-';
        }
    }

    function renderTableHeaders() {
        const thead = id('tableHead');
        if (!thead) return;
        const tr = document.createElement('tr');
        columns.forEach((col, i) => {
            const th = document.createElement('th');
            if (col.className) th.className = col.className;
            if (col.sortable) {
                th.onclick = () => sortTable(i);
                th.innerHTML = `${col.label}<span class="sort-icon"></span>`;
            } else {
                th.textContent = col.label;
            }
            tr.appendChild(th);
        });
        thead.innerHTML = '';
        thead.appendChild(tr);
    }

    function renderTable() {
        const tbody = id('tableBody');
        if (!tbody) return;
        if (state.filteredMovies.length === 0) {
            tbody.innerHTML = `<tr><td colspan="${columns.length}" class="no-results"><p>没有找到符合条件的记录</p></td></tr>`;
        } else {
            tbody.innerHTML = state.filteredMovies.map(item =>
                '<tr>' + columns.map(col => renderCell(col.key, item[col.key], item)).join('') + '</tr>'
            ).join('');
            initCommentTooltips();
        }
        updateStats();
    }

    function initCommentTooltips() {
        let tooltip = document.querySelector('.comment-tooltip');
        if (!tooltip) {
            tooltip = document.createElement('div');
            tooltip.className = 'comment-tooltip';
            document.body.appendChild(tooltip);
        }
        id('tableBody')?.querySelectorAll('.comment-cell[data-full-text]').forEach(cell => {
            cell.addEventListener('mouseenter', e => {
                const txt = cell.getAttribute('data-full-text');
                if (!txt || txt === '-') return;
                tooltip.textContent = txt;
                tooltip.classList.add('visible');
                positionTooltip(e, tooltip);
            });
            cell.addEventListener('mousemove', e => positionTooltip(e, tooltip));
            cell.addEventListener('mouseleave', () => tooltip.classList.remove('visible'));
        });
    }

    function positionTooltip(e, tooltip) {
        const ox = 15, oy = 15;
        let x = e.clientX + ox, y = e.clientY + oy;
        const r = tooltip.getBoundingClientRect();
        if (x + r.width > window.innerWidth) x = e.clientX - r.width - ox;
        if (y + r.height > window.innerHeight) y = e.clientY - r.height - oy;
        tooltip.style.left = Math.max(5, x) + 'px';
        tooltip.style.top  = Math.max(5, y) + 'px';
    }

    function sortTable(col, toggle = true) {
        const headers = id('tableHead')?.querySelectorAll('th') || [];
        headers.forEach(h => h.classList.remove('sorted'));
        if (toggle && state.sortColumn === col) {
            state.sortDirection = state.sortDirection === 'asc' ? 'desc' : 'asc';
        } else if (toggle) {
            state.sortDirection = 'asc';
        }
        state.sortColumn = col;
        if (headers[col]) {
            headers[col].classList.add('sorted');
            const icon = headers[col].querySelector('.sort-icon');
            if (icon) icon.textContent = state.sortDirection === 'asc' ? '↑' : '↓';
        }
        const key = columns[col]?.key;
        if (!key) return;
        state.filteredMovies.sort((a, b) => {
            let va = a[key], vb = b[key];
            if (['rating', 'voteCount', 'usefulCount', 'year'].includes(key)) { va = Number(va) || 0; vb = Number(vb) || 0; }
            else if (Array.isArray(va)) { va = va[0] || ''; vb = vb[0] || ''; }
            if (typeof va === 'string') { va = va.toLowerCase(); vb = (vb || '').toLowerCase(); }
            return state.sortDirection === 'asc' ? (va > vb ? 1 : -1) : (va < vb ? 1 : -1);
        });
        renderTable();
    }

    function applyFilters() {
        const search = id('searchTitle')?.value.toLowerCase() || '';
        state.filteredMovies = state.movies.filter(item => {
            const matchTitle = !search ||
                (item.title && item.title.toLowerCase().includes(search)) ||
                (item.originalTitle && item.originalTitle.toLowerCase().includes(search)) ||
                (item.otherTitles && item.otherTitles.toLowerCase().includes(search));

            let matchRating = true;
            if (state.selectedRatings.length) matchRating = state.selectedRatings.some(r => {
                if (r === '9.5分以上') return item.rating >= 9.5;
                if (r === '9分以上')  return item.rating >= 9.0;
                if (r === '8.5分以上') return item.rating >= 8.5;
                if (r === '8分以上')  return item.rating >= 8.0;
                return true;
            });

            let matchYear = true;
            if (state.selectedYears.length) matchYear = state.selectedYears.some(y => {
                if (y === '2020年及以后') return item.year >= 2020;
                if (y === '2010年及以后') return item.year >= 2010;
                if (y === '2000年及以后') return item.year >= 2000;
                if (y === '1990年及以后') return item.year >= 1990;
                if (y === '1980年及以后') return item.year >= 1980;
                if (y === '1980年以前')  return item.year < 1980;
                return true;
            });

            let matchVote = true;
            if (state.selectedVoteCounts.length) matchVote = state.selectedVoteCounts.some(v => {
                const vc = item.voteCount || item.useful_count || 0;
                if (v === '100万以上') return vc >= 1000000;
                if (v === '50万以上')  return vc >= 500000;
                if (v === '20万以上')  return vc >= 200000;
                if (v === '10万以上')  return vc >= 100000;
                return true;
            });

            let matchPlayable = true;
            if (state.selectedPlayables.length) matchPlayable = state.selectedPlayables.some(p => {
                if (p === '仅可播放') return item.playable === true;
                if (p === '不可播放') return item.playable !== true;
                return true;
            });

            const getList = (v, sep) => Array.isArray(v) ? v : (typeof v === 'string' ? v.split(sep).map(s => s.trim()).filter(s => s) : []);

            const matchCountry = !state.selectedCountries.length || state.selectedCountries.some(c => getList(item.country, ' ').includes(c));
            const matchGenre   = opts.filterExtra ? true :
                (!state.selectedGenres.length || state.selectedGenres.some(g => getList(item.genre, ' ').includes(g)));
            const matchDirector = !state.selectedDirectors.length || state.selectedDirectors.some(d => getList(item.director, '/').includes(d));
            const matchStarring = !state.selectedStarrings.length || (item.starring || item.cast || []).some(a => state.selectedStarrings.includes(a));
            const matchPlatform = !state.selectedPlatforms.length || state.selectedPlatforms.some(p => {
                const pl = Array.isArray(item.platforms) ? item.platforms : (item.platforms || '').split('/').map(s => s.trim()).filter(s => s);
                return pl.includes(p);
            });

            const matchExtra = opts.filterExtra ? opts.filterExtra(item, state) : true;
            return matchTitle && matchRating && matchYear && matchVote && matchPlayable &&
                   matchCountry && matchGenre && matchDirector && matchStarring && matchPlatform && matchExtra;
        });

        renderAllFilters(state.movies);
        updateActiveFiltersInfo();
        sortTable(state.sortColumn, false);
    }

    function resetFilters() {
        const search = id('searchTitle');
        if (search) search.value = '';
        state.selectedCountries = [];
        state.selectedGenres = [];
        state.selectedPlatforms = [];
        state.selectedDirectors = [];
        state.selectedStarrings = [];
        state.selectedRatings = [];
        state.selectedYears = [];
        state.selectedVoteCounts = [];
        state.selectedPlayables = [];
        if (opts.resetExtra) opts.resetExtra(state);
        state.filteredMovies = [...state.movies];
        renderAllFilters(state.filteredMovies);
        updateActiveFiltersInfo();
        sortTable(state.sortColumn, false);
    }

    function exportFiltered() {
        const headers = columns.map(c => c.label);
        const rows = [headers.join(',')];
        state.filteredMovies.forEach(item => {
            const row = columns.map(col => {
                let v = item[col.key];
                if (Array.isArray(v)) v = v.join('; ');
                if (col.key === 'playable') v = item.playable ? '是' : '否';
                if (col.key === 'starring') { const a = item.starring || item.cast || []; v = Array.isArray(a) ? a.join('; ') : ''; }
                if (typeof v === 'string' && v.includes(',')) v = '"' + v + '"';
                return v ?? '';
            });
            rows.push(row.join(','));
        });
        const blob = new Blob(['﻿' + rows.join('\n')], { type: 'text/csv;charset=utf-8' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = exportName + '_筛选结果_' + new Date().toISOString().slice(0, 10) + '.csv';
        a.click();
    }

    return {
        ns,
        _loaded: false,
        _toggle(type, value) {
            const map = {
                country: 'selectedCountries', genre: 'selectedGenres', director: 'selectedDirectors',
                starring: 'selectedStarrings', rating: 'selectedRatings', year: 'selectedYears',
                voteCount: 'selectedVoteCounts', playable: 'selectedPlayables', platform: 'selectedPlatforms',
                criticScore: 'selectedCriticScores', userScore: 'selectedUserScores',
                sentiment: 'selectedSentiments', esrb: 'selectedEsrbs',
                certificate: 'selectedCertificates'
            };
            const arr = state[map[type]];
            const i = arr.indexOf(value);
            i > -1 ? arr.splice(i, 1) : arr.push(value);
            applyFilters();
        },
        applyFilters,
        resetFilters,
        exportFiltered,
        load() {
            if (this._loaded) return;
            this._loaded = true;
            fetch(jsonFile)
                .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status} – ${r.url}`); return r.json(); })
                .then(data => {
                    state.movies = Array.isArray(data) ? data : [];
                    state.filteredMovies = [...state.movies];
                    renderTableHeaders();
                    renderAllFilters(state.filteredMovies);
                    if (opts.defaultSort) state.sortDirection = opts.defaultSort.dir;
                    sortTable(opts.defaultSort ? opts.defaultSort.col : 0, false);
                    updateStats();
                    const searchEl = id('searchTitle');
                    if (searchEl) searchEl.addEventListener('input', applyFilters);
                })
                .catch(err => {
                    this._loaded = false;
                    console.error('Load failed for', jsonFile, err);
                    const tbody = id('tableBody');
                    if (tbody) tbody.innerHTML = `<tr><td colspan="20" class="no-results"><p>数据加载失败：${err.message}</p><p style="font-size:0.8rem;margin-top:8px;color:#aaa">${jsonFile}</p></td></tr>`;
                });
        }
    };
}

function dbImg(url, w, h, extraStyle) {
    return `<img src="${url}" style="width:${w}px;height:${h}px;object-fit:cover;display:block;${extraStyle || ''}" loading="lazy" onerror="this.style.display='none'">`;
}

// ── Page instances ────────────────────────────
const pages = {
    'top250': createPage('top250', 'top250',
        [
            { key: 'rank',        label: '排名',     sortable: true,  className: 'rank' },
            { key: 'title',       label: '中文名',   sortable: true },
            { key: 'otherTitles', label: '其他名称', sortable: false },
            { key: 'rating',      label: '评分',     sortable: true },
            { key: 'voteCount',   label: '评价人数', sortable: true },
            { key: 'director',    label: '导演',     sortable: true },
            { key: 'starring',    label: '主演',     sortable: true },
            { key: 'year',        label: '年份',     sortable: true,  className: 'year' },
            { key: 'country',     label: '地区',     sortable: true,  className: 'country' },
            { key: 'genre',       label: '类型',     sortable: true,  className: 'genre' },
            { key: 'quote',       label: '短评',     sortable: true },
            { key: 'playable',    label: '可播放',   sortable: true }
        ],
        'data/rankings/douban-top250-movies.json', '豆瓣Top250'),

    'imdb-top250': createPage('imdb250', 'imdb-top250',
        [
            { key: 'rank',        label: '排名',     sortable: true,  className: 'rank' },
            { key: 'title',       label: '片名',     sortable: true },
            { key: 'rating',      label: '评分',     sortable: true },
            { key: 'voteCount',   label: '评价人数', sortable: true },
            { key: 'year',        label: '年份',     sortable: true,  className: 'year' },
            { key: 'runtime',     label: '时长',     sortable: true },
            { key: 'certificate', label: '分级',     sortable: true },
            { key: 'genres',      label: '类型',     sortable: false, className: 'genre' },
            { key: 'plot',        label: '简介',     sortable: false }
        ],
        'data/rankings/imdb-top250-movies.json', 'IMDb Top250',
        {
            defaultSort: { col: 0, dir: 'asc' },
            extraState: { selectedCertificates: [] },
            resetExtra(state) { state.selectedCertificates = []; },
            buildStatic(source) {
                const ratingOpts = { '9分以上': m => m.rating >= 9.0, '8.5分以上': m => m.rating >= 8.5, '8分以上': m => m.rating >= 8.0 };
                const yearOpts = { '2020年及以后': m => m.year >= 2020, '2010年及以后': m => m.year >= 2010, '2000年及以后': m => m.year >= 2000, '1990年及以后': m => m.year >= 1990, '1990年以前': m => m.year < 1990 };
                const voteOpts = { '200万以上': m => (m.voteCount || 0) >= 2000000, '100万以上': m => (m.voteCount || 0) >= 1000000, '50万以上': m => (m.voteCount || 0) >= 500000 };
                const mk = (opts) => Object.fromEntries(Object.entries(opts).map(([k, fn]) => [k, source.filter(fn).length]));
                return { rating: mk(ratingOpts), year: mk(yearOpts), voteCount: mk(voteOpts), playable: {} };
            },
            computeDyn(source) {
                const genre = {}, certificate = {};
                source.forEach(m => {
                    (m.genres || []).forEach(g => { genre[g] = (genre[g] || 0) + 1; });
                    if (m.certificate) certificate[m.certificate] = (certificate[m.certificate] || 0) + 1;
                });
                return { country: {}, genre, platform: {}, director: {}, starring: {}, certificate };
            },
            renderExtra(state, id, renderCB, renderStaticCB) {
                const dyn = this.computeDyn(state.filteredMovies);
                renderCB('certificateFilter', dyn.certificate, state.selectedCertificates, 'certificate');
            },
            filterExtra(item, state) {
                const matchCert = !state.selectedCertificates.length || state.selectedCertificates.includes(item.certificate);
                const matchGenre = !state.selectedGenres.length || state.selectedGenres.some(g => (item.genres || []).includes(g));
                return matchCert && matchGenre;
            },
            renderCellFn(key, value, item) {
                if (key === 'title') {
                    return `<td><a href="${item.url}" target="_blank" class="movie-title-link">${value || '-'}</a></td>`;
                }
                if (key === 'voteCount') {
                    const v = value || 0;
                    const fmt = v >= 1000000 ? (v / 10000).toFixed(0) + '万' : v >= 10000 ? (v / 10000).toFixed(1) + '万' : v;
                    return `<td>${fmt}</td>`;
                }
                if (key === 'runtime') {
                    const sec = item.runtimeSeconds;
                    if (!sec) return '<td>-</td>';
                    const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60);
                    return `<td>${h > 0 ? h + 'h ' : ''}${m}m</td>`;
                }
                if (key === 'genres') {
                    return `<td class="genre">${(value || []).join(', ') || '-'}</td>`;
                }
                if (key === 'plot') {
                    const text = value || '';
                    const display = text.length > 30 ? text.substring(0, 30) + '...' : text;
                    return `<td class="comment-cell" data-full-text="${text.replace(/"/g, '&quot;')}">${display || '-'}</td>`;
                }
            }
        }),

    'mc-3ds-games': createPage('mc3ds', 'mc-3ds-games',
        [
            { key: 'title',         label: '游戏名称', sortable: true },
            { key: 'year',          label: '年份',     sortable: true,  className: 'year' },
            { key: 'releaseDate',   label: '发售日期', sortable: true },
            { key: 'criticScore',   label: '媒体评分', sortable: true },
            { key: 'criticReviews', label: '评论数',   sortable: true },
            { key: 'sentiment',     label: '媒体口碑', sortable: true },
            { key: 'userScore',     label: '用户评分', sortable: true },
            { key: 'genres',        label: '类型',     sortable: false, className: 'genre' },
            { key: 'esrbRating',    label: 'ESRB分级', sortable: true },
            { key: 'description',   label: '简介',     sortable: false }
        ],
        'data/rankings/mc-3ds-games.json', 'MC 3DS榜单',
        {
            defaultSort: { col: 3, dir: 'desc' },
            extraState: {
                selectedCriticScores: [],
                selectedUserScores: [],
                selectedSentiments: [],
                selectedEsrbs: []
            },
            resetExtra(state) {
                state.selectedCriticScores = [];
                state.selectedUserScores = [];
                state.selectedSentiments = [];
                state.selectedEsrbs = [];
            },
            buildStatic(source) {
                const cs = { '90+': 0, '85+': 0, '80+': 0 };
                const us = { '9.0+': 0, '8.5+': 0, '8.0+': 0 };
                const yr = { '2017年及以后': 0, '2015年及以后': 0, '2013年及以后': 0, '2013年以前': 0 };
                source.forEach(m => {
                    if ((m.criticScore || 0) >= 90) cs['90+']++;
                    if ((m.criticScore || 0) >= 85) cs['85+']++;
                    if ((m.criticScore || 0) >= 80) cs['80+']++;
                    if ((m.userScore || 0) >= 9.0) us['9.0+']++;
                    if ((m.userScore || 0) >= 8.5) us['8.5+']++;
                    if ((m.userScore || 0) >= 8.0) us['8.0+']++;
                    if (m.year >= 2017) yr['2017年及以后']++;
                    if (m.year >= 2015) yr['2015年及以后']++;
                    if (m.year >= 2013) yr['2013年及以后']++;
                    if (m.year < 2013)  yr['2013年以前']++;
                });
                return { rating: cs, userScore: us, year: yr, voteCount: {}, playable: {} };
            },
            computeDyn(source) {
                const genre = {}, sentiment = {}, esrb = {};
                source.forEach(m => {
                    (m.genres || []).forEach(g => { genre[g] = (genre[g] || 0) + 1; });
                    if (m.sentiment) sentiment[m.sentiment] = (sentiment[m.sentiment] || 0) + 1;
                    if (m.esrbRating) esrb[m.esrbRating] = (esrb[m.esrbRating] || 0) + 1;
                });
                return { country: {}, genre, platform: {}, director: {}, starring: {}, sentiment, esrb };
            },
            renderExtra(state, id, renderCB, renderStaticCB) {
                const dyn = this.computeDyn(state.filteredMovies);
                const stat = this.buildStatic(state.filteredMovies);
                renderStaticCB('criticScoreFilter', stat.rating, state.selectedCriticScores, 'criticScore');
                renderStaticCB('userScoreFilter', stat.userScore, state.selectedUserScores, 'userScore');
                renderCB('sentimentFilter', dyn.sentiment, state.selectedSentiments, 'sentiment');
                renderCB('esrbFilter', dyn.esrb, state.selectedEsrbs, 'esrb');
            },
            filterExtra(item, state) {
                const matchCS = !state.selectedCriticScores.length || state.selectedCriticScores.some(v => {
                    if (v === '90+') return (item.criticScore || 0) >= 90;
                    if (v === '85+') return (item.criticScore || 0) >= 85;
                    if (v === '80+') return (item.criticScore || 0) >= 80;
                    return true;
                });
                const matchUS = !state.selectedUserScores.length || state.selectedUserScores.some(v => {
                    if (v === '9.0+') return (item.userScore || 0) >= 9.0;
                    if (v === '8.5+') return (item.userScore || 0) >= 8.5;
                    if (v === '8.0+') return (item.userScore || 0) >= 8.0;
                    return true;
                });
                const matchSentiment = !state.selectedSentiments.length || state.selectedSentiments.includes(item.sentiment);
                const matchEsrb = !state.selectedEsrbs.length || state.selectedEsrbs.includes(item.esrbRating);
                const matchGenre = !state.selectedGenres.length || state.selectedGenres.some(g => (item.genres || []).includes(g));
                return matchCS && matchUS && matchSentiment && matchEsrb && matchGenre;
            },
            renderCellFn(key, value, item) {
                if (key === 'title') {
                    const url = `https://www.metacritic.com/game/${item.slug}/`;
                    return `<td><a href="${url}" target="_blank" class="movie-title-link">${value || '-'}</a></td>`;
                }
                if (key === 'criticScore') {
                    const score = value;
                    const color = score >= 90 ? '#00A65F' : score >= 75 ? '#fc0' : '#f44';
                    return `<td><span style="font-weight:bold;color:${color}">${score ?? '-'}</span></td>`;
                }
                if (key === 'userScore') {
                    return `<td class="rating">${value != null ? Number(value).toFixed(1) : '-'}</td>`;
                }
                if (key === 'genres') {
                    return `<td class="genre">${(value || []).join(', ') || '-'}</td>`;
                }
                if (key === 'description') {
                    const text = value || '';
                    const display = text.length > 30 ? text.substring(0, 30) + '...' : text;
                    return `<td class="comment-cell" data-full-text="${text.replace(/"/g, '&quot;')}">${display || '-'}</td>`;
                }
            }
        }),

    'mc-nds-games': createPage('mcnds', 'mc-nds-games',
        [
            { key: 'title',         label: '游戏名称', sortable: true },
            { key: 'year',          label: '年份',     sortable: true,  className: 'year' },
            { key: 'releaseDate',   label: '发售日期', sortable: true },
            { key: 'criticScore',   label: '媒体评分', sortable: true },
            { key: 'criticReviews', label: '评论数',   sortable: true },
            { key: 'sentiment',     label: '媒体口碑', sortable: true },
            { key: 'userScore',     label: '用户评分', sortable: true },
            { key: 'genres',        label: '类型',     sortable: false, className: 'genre' },
            { key: 'esrbRating',    label: 'ESRB分级', sortable: true },
            { key: 'description',   label: '简介',     sortable: false }
        ],
        'data/rankings/mc-nds-games.json', 'MC NDS榜单',
        {
            defaultSort: { col: 3, dir: 'desc' },
            extraState: {
                selectedCriticScores: [],
                selectedUserScores: [],
                selectedSentiments: [],
                selectedEsrbs: []
            },
            resetExtra(state) {
                state.selectedCriticScores = [];
                state.selectedUserScores = [];
                state.selectedSentiments = [];
                state.selectedEsrbs = [];
            },
            buildStatic(source) {
                const cs = { '90+': 0, '85+': 0, '80+': 0 };
                const us = { '9.0+': 0, '8.5+': 0, '8.0+': 0 };
                const yr = { '2010年及以后': 0, '2008年及以后': 0, '2006年及以后': 0, '2006年以前': 0 };
                source.forEach(m => {
                    if ((m.criticScore || 0) >= 90) cs['90+']++;
                    if ((m.criticScore || 0) >= 85) cs['85+']++;
                    if ((m.criticScore || 0) >= 80) cs['80+']++;
                    if ((m.userScore || 0) >= 9.0) us['9.0+']++;
                    if ((m.userScore || 0) >= 8.5) us['8.5+']++;
                    if ((m.userScore || 0) >= 8.0) us['8.0+']++;
                    if (m.year >= 2010) yr['2010年及以后']++;
                    if (m.year >= 2008) yr['2008年及以后']++;
                    if (m.year >= 2006) yr['2006年及以后']++;
                    if (m.year < 2006)  yr['2006年以前']++;
                });
                return { rating: cs, userScore: us, year: yr, voteCount: {}, playable: {} };
            },
            computeDyn(source) {
                const genre = {}, sentiment = {}, esrb = {};
                source.forEach(m => {
                    (m.genres || []).forEach(g => { genre[g] = (genre[g] || 0) + 1; });
                    if (m.sentiment) sentiment[m.sentiment] = (sentiment[m.sentiment] || 0) + 1;
                    if (m.esrbRating) esrb[m.esrbRating] = (esrb[m.esrbRating] || 0) + 1;
                });
                return { country: {}, genre, platform: {}, director: {}, starring: {}, sentiment, esrb };
            },
            renderExtra(state, id, renderCB, renderStaticCB) {
                const dyn = this.computeDyn(state.filteredMovies);
                const stat = this.buildStatic(state.filteredMovies);
                renderStaticCB('criticScoreFilter', stat.rating, state.selectedCriticScores, 'criticScore');
                renderStaticCB('userScoreFilter', stat.userScore, state.selectedUserScores, 'userScore');
                renderCB('sentimentFilter', dyn.sentiment, state.selectedSentiments, 'sentiment');
                renderCB('esrbFilter', dyn.esrb, state.selectedEsrbs, 'esrb');
            },
            filterExtra(item, state) {
                const matchCS = !state.selectedCriticScores.length || state.selectedCriticScores.some(v => {
                    if (v === '90+') return (item.criticScore || 0) >= 90;
                    if (v === '85+') return (item.criticScore || 0) >= 85;
                    if (v === '80+') return (item.criticScore || 0) >= 80;
                    return true;
                });
                const matchUS = !state.selectedUserScores.length || state.selectedUserScores.some(v => {
                    if (v === '9.0+') return (item.userScore || 0) >= 9.0;
                    if (v === '8.5+') return (item.userScore || 0) >= 8.5;
                    if (v === '8.0+') return (item.userScore || 0) >= 8.0;
                    return true;
                });
                const matchSentiment = !state.selectedSentiments.length || state.selectedSentiments.includes(item.sentiment);
                const matchEsrb = !state.selectedEsrbs.length || state.selectedEsrbs.includes(item.esrbRating);
                const matchGenre = !state.selectedGenres.length || state.selectedGenres.some(g => (item.genres || []).includes(g));
                return matchCS && matchUS && matchSentiment && matchEsrb && matchGenre;
            },
            renderCellFn(key, value, item) {
                if (key === 'title') {
                    const url = `https://www.metacritic.com/game/${item.slug}/`;
                    return `<td><a href="${url}" target="_blank" class="movie-title-link">${value || '-'}</a></td>`;
                }
                if (key === 'criticScore') {
                    const score = value;
                    const color = score >= 90 ? '#00A65F' : score >= 75 ? '#fc0' : '#f44';
                    return `<td><span style="font-weight:bold;color:${color}">${score ?? '-'}</span></td>`;
                }
                if (key === 'userScore') {
                    return `<td class="rating">${value != null ? Number(value).toFixed(1) : '-'}</td>`;
                }
                if (key === 'genres') {
                    return `<td class="genre">${(value || []).join(', ') || '-'}</td>`;
                }
                if (key === 'description') {
                    const text = value || '';
                    const display = text.length > 30 ? text.substring(0, 30) + '...' : text;
                    return `<td class="comment-cell" data-full-text="${text.replace(/"/g, '&quot;')}">${display || '-'}</td>`;
                }
            }
        }),

    'mc-gba-games': createPage('mcgba', 'mc-gba-games',
        [
            { key: 'title',         label: '游戏名称', sortable: true },
            { key: 'year',          label: '年份',     sortable: true,  className: 'year' },
            { key: 'releaseDate',   label: '发售日期', sortable: true },
            { key: 'criticScore',   label: '媒体评分', sortable: true },
            { key: 'criticReviews', label: '评论数',   sortable: true },
            { key: 'sentiment',     label: '媒体口碑', sortable: true },
            { key: 'userScore',     label: '用户评分', sortable: true },
            { key: 'genres',        label: '类型',     sortable: false, className: 'genre' },
            { key: 'esrbRating',    label: 'ESRB分级', sortable: true },
            { key: 'description',   label: '简介',     sortable: false }
        ],
        'data/rankings/mc-gba-games.json', 'MC GBA榜单',
        {
            defaultSort: { col: 3, dir: 'desc' },
            extraState: {
                selectedCriticScores: [],
                selectedUserScores: [],
                selectedSentiments: [],
                selectedEsrbs: []
            },
            resetExtra(state) {
                state.selectedCriticScores = [];
                state.selectedUserScores = [];
                state.selectedSentiments = [];
                state.selectedEsrbs = [];
            },
            buildStatic(source) {
                const cs = { '90+': 0, '85+': 0, '80+': 0 };
                const us = { '9.0+': 0, '8.5+': 0, '8.0+': 0 };
                const yr = { '2005年及以后': 0, '2003年及以后': 0, '2001年及以后': 0 };
                source.forEach(m => {
                    if ((m.criticScore || 0) >= 90) cs['90+']++;
                    if ((m.criticScore || 0) >= 85) cs['85+']++;
                    if ((m.criticScore || 0) >= 80) cs['80+']++;
                    if ((m.userScore || 0) >= 9.0) us['9.0+']++;
                    if ((m.userScore || 0) >= 8.5) us['8.5+']++;
                    if ((m.userScore || 0) >= 8.0) us['8.0+']++;
                    if (m.year >= 2005) yr['2005年及以后']++;
                    if (m.year >= 2003) yr['2003年及以后']++;
                    if (m.year >= 2001) yr['2001年及以后']++;
                });
                return { rating: cs, userScore: us, year: yr, voteCount: {}, playable: {} };
            },
            computeDyn(source) {
                const genre = {}, sentiment = {}, esrb = {};
                source.forEach(m => {
                    (m.genres || []).forEach(g => { genre[g] = (genre[g] || 0) + 1; });
                    if (m.sentiment) sentiment[m.sentiment] = (sentiment[m.sentiment] || 0) + 1;
                    if (m.esrbRating) esrb[m.esrbRating] = (esrb[m.esrbRating] || 0) + 1;
                });
                return { country: {}, genre, platform: {}, director: {}, starring: {}, sentiment, esrb };
            },
            renderExtra(state, id, renderCB, renderStaticCB) {
                const dyn = this.computeDyn(state.filteredMovies);
                const stat = this.buildStatic(state.filteredMovies);
                renderStaticCB('criticScoreFilter', stat.rating, state.selectedCriticScores, 'criticScore');
                renderStaticCB('userScoreFilter', stat.userScore, state.selectedUserScores, 'userScore');
                renderCB('sentimentFilter', dyn.sentiment, state.selectedSentiments, 'sentiment');
                renderCB('esrbFilter', dyn.esrb, state.selectedEsrbs, 'esrb');
            },
            filterExtra(item, state) {
                const matchCS = !state.selectedCriticScores.length || state.selectedCriticScores.some(v => {
                    if (v === '90+') return (item.criticScore || 0) >= 90;
                    if (v === '85+') return (item.criticScore || 0) >= 85;
                    if (v === '80+') return (item.criticScore || 0) >= 80;
                    return true;
                });
                const matchUS = !state.selectedUserScores.length || state.selectedUserScores.some(v => {
                    if (v === '9.0+') return (item.userScore || 0) >= 9.0;
                    if (v === '8.5+') return (item.userScore || 0) >= 8.5;
                    if (v === '8.0+') return (item.userScore || 0) >= 8.0;
                    return true;
                });
                const matchSentiment = !state.selectedSentiments.length || state.selectedSentiments.includes(item.sentiment);
                const matchEsrb = !state.selectedEsrbs.length || state.selectedEsrbs.includes(item.esrbRating);
                const matchGenre = !state.selectedGenres.length || state.selectedGenres.some(g => (item.genres || []).includes(g));
                return matchCS && matchUS && matchSentiment && matchEsrb && matchGenre;
            },
            renderCellFn(key, value, item) {
                if (key === 'title') {
                    const url = `https://www.metacritic.com/game/${item.slug}/`;
                    return `<td><a href="${url}" target="_blank" class="movie-title-link">${value || '-'}</a></td>`;
                }
                if (key === 'criticScore') {
                    const score = value;
                    const color = score >= 90 ? '#00A65F' : score >= 75 ? '#fc0' : '#f44';
                    return `<td><span style="font-weight:bold;color:${color}">${score ?? '-'}</span></td>`;
                }
                if (key === 'userScore') {
                    return `<td class="rating">${value != null ? Number(value).toFixed(1) : '-'}</td>`;
                }
                if (key === 'genres') {
                    return `<td class="genre">${(value || []).join(', ') || '-'}</td>`;
                }
                if (key === 'description') {
                    const text = value || '';
                    const display = text.length > 30 ? text.substring(0, 30) + '...' : text;
                    return `<td class="comment-cell" data-full-text="${text.replace(/"/g, '&quot;')}">${display || '-'}</td>`;
                }
            }
        }),

    'mc-psp-games': createPage('mcpsp', 'mc-psp-games',
        [
            { key: 'title',         label: '游戏名称', sortable: true },
            { key: 'year',          label: '年份',     sortable: true,  className: 'year' },
            { key: 'releaseDate',   label: '发售日期', sortable: true },
            { key: 'criticScore',   label: '媒体评分', sortable: true },
            { key: 'criticReviews', label: '评论数',   sortable: true },
            { key: 'sentiment',     label: '媒体口碑', sortable: true },
            { key: 'userScore',     label: '用户评分', sortable: true },
            { key: 'genres',        label: '类型',     sortable: false, className: 'genre' },
            { key: 'esrbRating',    label: 'ESRB分级', sortable: true },
            { key: 'description',   label: '简介',     sortable: false }
        ],
        'data/rankings/mc-psp-games.json', 'MC PSP榜单',
        {
            defaultSort: { col: 3, dir: 'desc' },
            extraState: {
                selectedCriticScores: [],
                selectedUserScores: [],
                selectedSentiments: [],
                selectedEsrbs: []
            },
            resetExtra(state) {
                state.selectedCriticScores = [];
                state.selectedUserScores = [];
                state.selectedSentiments = [];
                state.selectedEsrbs = [];
            },
            buildStatic(source) {
                const cs = { '90+': 0, '85+': 0, '80+': 0 };
                const us = { '9.0+': 0, '8.5+': 0, '8.0+': 0 };
                const yr = { '2008年及以后': 0, '2006年及以后': 0, '2004年及以后': 0 };
                source.forEach(m => {
                    if ((m.criticScore || 0) >= 90) cs['90+']++;
                    if ((m.criticScore || 0) >= 85) cs['85+']++;
                    if ((m.criticScore || 0) >= 80) cs['80+']++;
                    if ((m.userScore || 0) >= 9.0) us['9.0+']++;
                    if ((m.userScore || 0) >= 8.5) us['8.5+']++;
                    if ((m.userScore || 0) >= 8.0) us['8.0+']++;
                    if (m.year >= 2008) yr['2008年及以后']++;
                    if (m.year >= 2006) yr['2006年及以后']++;
                    if (m.year >= 2004) yr['2004年及以后']++;
                });
                return { rating: cs, userScore: us, year: yr, voteCount: {}, playable: {} };
            },
            computeDyn(source) {
                const genre = {}, sentiment = {}, esrb = {};
                source.forEach(m => {
                    (m.genres || []).forEach(g => { genre[g] = (genre[g] || 0) + 1; });
                    if (m.sentiment) sentiment[m.sentiment] = (sentiment[m.sentiment] || 0) + 1;
                    if (m.esrbRating) esrb[m.esrbRating] = (esrb[m.esrbRating] || 0) + 1;
                });
                return { country: {}, genre, platform: {}, director: {}, starring: {}, sentiment, esrb };
            },
            renderExtra(state, id, renderCB, renderStaticCB) {
                const dyn = this.computeDyn(state.filteredMovies);
                const stat = this.buildStatic(state.filteredMovies);
                renderStaticCB('criticScoreFilter', stat.rating, state.selectedCriticScores, 'criticScore');
                renderStaticCB('userScoreFilter', stat.userScore, state.selectedUserScores, 'userScore');
                renderCB('sentimentFilter', dyn.sentiment, state.selectedSentiments, 'sentiment');
                renderCB('esrbFilter', dyn.esrb, state.selectedEsrbs, 'esrb');
            },
            filterExtra(item, state) {
                const matchCS = !state.selectedCriticScores.length || state.selectedCriticScores.some(v => {
                    if (v === '90+') return (item.criticScore || 0) >= 90;
                    if (v === '85+') return (item.criticScore || 0) >= 85;
                    if (v === '80+') return (item.criticScore || 0) >= 80;
                    return true;
                });
                const matchUS = !state.selectedUserScores.length || state.selectedUserScores.some(v => {
                    if (v === '9.0+') return (item.userScore || 0) >= 9.0;
                    if (v === '8.5+') return (item.userScore || 0) >= 8.5;
                    if (v === '8.0+') return (item.userScore || 0) >= 8.0;
                    return true;
                });
                const matchSentiment = !state.selectedSentiments.length || state.selectedSentiments.includes(item.sentiment);
                const matchEsrb = !state.selectedEsrbs.length || state.selectedEsrbs.includes(item.esrbRating);
                const matchGenre = !state.selectedGenres.length || state.selectedGenres.some(g => (item.genres || []).includes(g));
                return matchCS && matchUS && matchSentiment && matchEsrb && matchGenre;
            },
            renderCellFn(key, value, item) {
                if (key === 'title') {
                    const url = `https://www.metacritic.com/game/${item.slug}/`;
                    return `<td><a href="${url}" target="_blank" class="movie-title-link">${value || '-'}</a></td>`;
                }
                if (key === 'criticScore') {
                    const score = value;
                    const color = score >= 90 ? '#00A65F' : score >= 75 ? '#fc0' : '#f44';
                    return `<td><span style="font-weight:bold;color:${color}">${score ?? '-'}</span></td>`;
                }
                if (key === 'userScore') {
                    return `<td class="rating">${value != null ? Number(value).toFixed(1) : '-'}</td>`;
                }
                if (key === 'genres') {
                    return `<td class="genre">${(value || []).join(', ') || '-'}</td>`;
                }
                if (key === 'description') {
                    const text = value || '';
                    const display = text.length > 30 ? text.substring(0, 30) + '...' : text;
                    return `<td class="comment-cell" data-full-text="${text.replace(/"/g, '&quot;')}">${display || '-'}</td>`;
                }
            }
        }),

    'mc-ps1-games': createPage('mcps1', 'mc-ps1-games',
        [
            { key: 'title',         label: '游戏名称', sortable: true },
            { key: 'year',          label: '年份',     sortable: true,  className: 'year' },
            { key: 'releaseDate',   label: '发售日期', sortable: true },
            { key: 'criticScore',   label: '媒体评分', sortable: true },
            { key: 'criticReviews', label: '评论数',   sortable: true },
            { key: 'sentiment',     label: '媒体口碑', sortable: true },
            { key: 'userScore',     label: '用户评分', sortable: true },
            { key: 'genres',        label: '类型',     sortable: false, className: 'genre' },
            { key: 'esrbRating',    label: 'ESRB分级', sortable: true },
            { key: 'description',   label: '简介',     sortable: false }
        ],
        'data/rankings/mc-ps1-games.json', 'MC PS1榜单',
        {
            defaultSort: { col: 3, dir: 'desc' },
            extraState: {
                selectedCriticScores: [],
                selectedUserScores: [],
                selectedSentiments: [],
                selectedEsrbs: []
            },
            resetExtra(state) {
                state.selectedCriticScores = [];
                state.selectedUserScores = [];
                state.selectedSentiments = [];
                state.selectedEsrbs = [];
            },
            buildStatic(source) {
                const cs = { '90+': 0, '85+': 0, '80+': 0 };
                const us = { '9.0+': 0, '8.5+': 0, '8.0+': 0 };
                const yr = { '2001年及以后': 0, '1999年及以后': 0, '1997年及以后': 0, '1997年以前': 0 };
                source.forEach(m => {
                    if ((m.criticScore || 0) >= 90) cs['90+']++;
                    if ((m.criticScore || 0) >= 85) cs['85+']++;
                    if ((m.criticScore || 0) >= 80) cs['80+']++;
                    if ((m.userScore || 0) >= 9.0) us['9.0+']++;
                    if ((m.userScore || 0) >= 8.5) us['8.5+']++;
                    if ((m.userScore || 0) >= 8.0) us['8.0+']++;
                    if (m.year >= 2001) yr['2001年及以后']++;
                    if (m.year >= 1999) yr['1999年及以后']++;
                    if (m.year >= 1997) yr['1997年及以后']++;
                    if (m.year < 1997)  yr['1997年以前']++;
                });
                return { rating: cs, userScore: us, year: yr, voteCount: {}, playable: {} };
            },
            computeDyn(source) {
                const genre = {}, sentiment = {}, esrb = {};
                source.forEach(m => {
                    (m.genres || []).forEach(g => { genre[g] = (genre[g] || 0) + 1; });
                    if (m.sentiment) sentiment[m.sentiment] = (sentiment[m.sentiment] || 0) + 1;
                    if (m.esrbRating) esrb[m.esrbRating] = (esrb[m.esrbRating] || 0) + 1;
                });
                return { country: {}, genre, platform: {}, director: {}, starring: {}, sentiment, esrb };
            },
            renderExtra(state, id, renderCB, renderStaticCB) {
                const dyn = this.computeDyn(state.filteredMovies);
                const stat = this.buildStatic(state.filteredMovies);
                renderStaticCB('criticScoreFilter', stat.rating, state.selectedCriticScores, 'criticScore');
                renderStaticCB('userScoreFilter', stat.userScore, state.selectedUserScores, 'userScore');
                renderCB('sentimentFilter', dyn.sentiment, state.selectedSentiments, 'sentiment');
                renderCB('esrbFilter', dyn.esrb, state.selectedEsrbs, 'esrb');
            },
            filterExtra(item, state) {
                const matchCS = !state.selectedCriticScores.length || state.selectedCriticScores.some(v => {
                    if (v === '90+') return (item.criticScore || 0) >= 90;
                    if (v === '85+') return (item.criticScore || 0) >= 85;
                    if (v === '80+') return (item.criticScore || 0) >= 80;
                    return true;
                });
                const matchUS = !state.selectedUserScores.length || state.selectedUserScores.some(v => {
                    if (v === '9.0+') return (item.userScore || 0) >= 9.0;
                    if (v === '8.5+') return (item.userScore || 0) >= 8.5;
                    if (v === '8.0+') return (item.userScore || 0) >= 8.0;
                    return true;
                });
                const matchSentiment = !state.selectedSentiments.length || state.selectedSentiments.includes(item.sentiment);
                const matchEsrb = !state.selectedEsrbs.length || state.selectedEsrbs.includes(item.esrbRating);
                const matchGenre = !state.selectedGenres.length || state.selectedGenres.some(g => (item.genres || []).includes(g));
                return matchCS && matchUS && matchSentiment && matchEsrb && matchGenre;
            },
            renderCellFn(key, value, item) {
                if (key === 'title') {
                    const url = `https://www.metacritic.com/game/${item.slug}/`;
                    return `<td><a href="${url}" target="_blank" class="movie-title-link">${value || '-'}</a></td>`;
                }
                if (key === 'criticScore') {
                    const score = value;
                    const color = score >= 90 ? '#00A65F' : score >= 75 ? '#fc0' : '#f44';
                    return `<td><span style="font-weight:bold;color:${color}">${score ?? '-'}</span></td>`;
                }
                if (key === 'userScore') {
                    return `<td class="rating">${value != null ? Number(value).toFixed(1) : '-'}</td>`;
                }
                if (key === 'genres') {
                    return `<td class="genre">${(value || []).join(', ') || '-'}</td>`;
                }
                if (key === 'description') {
                    const text = value || '';
                    const display = text.length > 30 ? text.substring(0, 30) + '...' : text;
                    return `<td class="comment-cell" data-full-text="${text.replace(/"/g, '&quot;')}">${display || '-'}</td>`;
                }
            }
        }),

    'best-books-ever': createPage('bbe', 'best-books-ever',
        [
            { key: 'rank',         label: '排名',     sortable: true,  className: 'rank' },
            { key: 'coverUrl',     label: '封面',     sortable: false },
            { key: 'title',        label: '书名',     sortable: true },
            { key: 'author',       label: '作者',     sortable: true },
            { key: 'avgRating',    label: '平均评分', sortable: true },
            { key: 'ratingsCount', label: '评价人数', sortable: true },
            { key: 'votesCount',   label: '票数',     sortable: true },
            { key: 'score',        label: '分数',     sortable: true }
        ],
        'data/rankings/best-books-ever.json', 'Best Books Ever',
        {
            defaultSort: { col: 0, dir: 'asc' },
            buildStatic(source) {
                const ratingOpts = { '4.4以上': m => m.avgRating >= 4.4, '4.2以上': m => m.avgRating >= 4.2, '4.0以上': m => m.avgRating >= 4.0, '4.0以下': m => m.avgRating < 4.0 };
                const voteOpts = { '100万以上': m => (m.ratingsCount || 0) >= 1000000, '50万以上': m => (m.ratingsCount || 0) >= 500000, '10万以上': m => (m.ratingsCount || 0) >= 100000 };
                const mk = opts => Object.fromEntries(Object.entries(opts).map(([k, fn]) => [k, source.filter(fn).length]));
                return { rating: mk(ratingOpts), year: {}, voteCount: mk(voteOpts), playable: {} };
            },
            computeDyn(source) {
                const director = {};
                source.forEach(m => {
                    if (m.author) director[m.author] = (director[m.author] || 0) + 1;
                });
                return { country: {}, genre: {}, platform: {}, director, starring: {} };
            },
            filterExtra(item, state) {
                const matchAuthor = !state.selectedDirectors.length || state.selectedDirectors.includes(item.author);
                let matchRating = true;
                if (state.selectedRatings.length) matchRating = state.selectedRatings.some(r => {
                    if (r === '4.4以上') return item.avgRating >= 4.4;
                    if (r === '4.2以上') return item.avgRating >= 4.2;
                    if (r === '4.0以上') return item.avgRating >= 4.0;
                    if (r === '4.0以下') return item.avgRating < 4.0;
                    return true;
                });
                let matchVote = true;
                if (state.selectedVoteCounts.length) matchVote = state.selectedVoteCounts.some(v => {
                    if (v === '100万以上') return (item.ratingsCount || 0) >= 1000000;
                    if (v === '50万以上') return (item.ratingsCount || 0) >= 500000;
                    if (v === '10万以上') return (item.ratingsCount || 0) >= 100000;
                    return true;
                });
                return matchAuthor && matchRating && matchVote;
            },
            renderCellFn(key, value, item) {
                if (key === 'coverUrl') {
                    if (!value) return '<td style="width:52px;"></td>';
                    const img = `<img src="${value}" style="width:40px;height:56px;object-fit:cover;border-radius:3px;" loading="lazy">`;
                    return `<td style="width:52px;padding:6px 4px;"><a href="${item.url}" target="_blank">${img}</a></td>`;
                }
                if (key === 'title') {
                    return `<td><a href="${item.url}" target="_blank" class="movie-title-link">${value || '-'}</a></td>`;
                }
                if (key === 'avgRating') {
                    return `<td class="rating">${value != null ? value.toFixed(2) : '-'}</td>`;
                }
                if (key === 'ratingsCount' || key === 'votesCount') {
                    const v = value || 0;
                    const fmt = v >= 1000000 ? (v / 10000).toFixed(0) + '万' : v >= 10000 ? (v / 10000).toFixed(1) + '万' : v;
                    return `<td>${fmt}</td>`;
                }
                if (key === 'score') {
                    const v = value || 0;
                    const fmt = v >= 1000000 ? (v / 10000).toFixed(0) + '万' : v >= 10000 ? (v / 10000).toFixed(1) + '万' : v;
                    return `<td>${fmt}</td>`;
                }
            }
        }),

    'billboard-global': createPage('billboard', 'billboard-global',
        [
            { key: 'rank',          label: '排名',     sortable: true,  className: 'rank' },
            { key: 'coverUrl',      label: '封面',     sortable: false },
            { key: 'title',         label: '曲目',     sortable: true },
            { key: 'artist',        label: '艺术家',   sortable: true },
            { key: 'lastWeek',      label: '上周排名', sortable: true },
            { key: 'peakPosition',  label: '峰值排名', sortable: true },
            { key: 'weeksOnChart',  label: '在榜周数', sortable: true }
        ],
        'data/rankings/billboard-global.json', 'Billboard Global 200',
        {
            defaultSort: { col: 0, dir: 'asc' },
            buildStatic(source) {
                const weeksOpts = { '10周以上': m => (m.weeksOnChart || 0) >= 10, '5周以上': m => (m.weeksOnChart || 0) >= 5, '2周以上': m => (m.weeksOnChart || 0) >= 2, '1周': m => (m.weeksOnChart || 0) === 1 };
                const mk = opts => Object.fromEntries(Object.entries(opts).map(([k, fn]) => [k, source.filter(fn).length]));
                return { rating: {}, year: {}, voteCount: mk(weeksOpts), playable: {} };
            },
            computeDyn(source) {
                const director = {};
                source.forEach(m => {
                    if (m.artist) director[m.artist] = (director[m.artist] || 0) + 1;
                });
                return { country: {}, genre: {}, platform: {}, director, starring: {} };
            },
            filterExtra(item, state) {
                const matchArtist = !state.selectedDirectors.length || state.selectedDirectors.includes(item.artist);
                let matchWeeks = true;
                if (state.selectedVoteCounts.length) matchWeeks = state.selectedVoteCounts.some(v => {
                    if (v === '10周以上') return (item.weeksOnChart || 0) >= 10;
                    if (v === '5周以上') return (item.weeksOnChart || 0) >= 5;
                    if (v === '2周以上') return (item.weeksOnChart || 0) >= 2;
                    if (v === '1周') return (item.weeksOnChart || 0) === 1;
                    return true;
                });
                return matchArtist && matchWeeks;
            },
            renderCellFn(key, value, item) {
                if (key === 'coverUrl') {
                    if (!value) return '<td style="width:52px;"></td>';
                    return `<td style="width:52px;padding:6px 4px;"><img src="${value}" style="width:48px;height:48px;object-fit:cover;border-radius:4px;" loading="lazy"></td>`;
                }
                if (key === 'lastWeek' || key === 'peakPosition') {
                    return `<td>${value != null ? value : '-'}</td>`;
                }
                if (key === 'weeksOnChart') {
                    return `<td>${value != null ? value : '-'}</td>`;
                }
            },
            statsExtra(filtered) {
                const avgWeeks = filtered.length ? (filtered.reduce((s, m) => s + (m.weeksOnChart || 0), 0) / filtered.length).toFixed(1) : '-';
                const peakOne = filtered.filter(m => m.peakPosition === 1).length;
                return { avgRating: avgWeeks, yearRange: peakOne + '首' };
            }
        }),

    'mc-ps2-games': createPage('mcps2', 'mc-ps2-games',
        [
            { key: 'title',         label: '游戏名称', sortable: true },
            { key: 'year',          label: '年份',     sortable: true,  className: 'year' },
            { key: 'releaseDate',   label: '发售日期', sortable: true },
            { key: 'criticScore',   label: '媒体评分', sortable: true },
            { key: 'criticReviews', label: '评论数',   sortable: true },
            { key: 'sentiment',     label: '媒体口碑', sortable: true },
            { key: 'userScore',     label: '用户评分', sortable: true },
            { key: 'genres',        label: '类型',     sortable: false, className: 'genre' },
            { key: 'esrbRating',    label: 'ESRB分级', sortable: true },
            { key: 'description',   label: '简介',     sortable: false }
        ],
        'data/rankings/mc-ps2-games.json', 'MC PS2榜单',
        {
            defaultSort: { col: 3, dir: 'desc' },
            extraState: {
                selectedCriticScores: [],
                selectedUserScores: [],
                selectedSentiments: [],
                selectedEsrbs: []
            },
            resetExtra(state) {
                state.selectedCriticScores = [];
                state.selectedUserScores = [];
                state.selectedSentiments = [];
                state.selectedEsrbs = [];
            },
            buildStatic(source) {
                const cs = { '90+': 0, '85+': 0, '80+': 0 };
                const us = { '9.0+': 0, '8.5+': 0, '8.0+': 0 };
                const yr = { '2005年及以后': 0, '2003年及以后': 0, '2001年及以后': 0, '2001年以前': 0 };
                source.forEach(m => {
                    if ((m.criticScore || 0) >= 90) cs['90+']++;
                    if ((m.criticScore || 0) >= 85) cs['85+']++;
                    if ((m.criticScore || 0) >= 80) cs['80+']++;
                    if ((m.userScore || 0) >= 9.0) us['9.0+']++;
                    if ((m.userScore || 0) >= 8.5) us['8.5+']++;
                    if ((m.userScore || 0) >= 8.0) us['8.0+']++;
                    if (m.year >= 2005) yr['2005年及以后']++;
                    if (m.year >= 2003) yr['2003年及以后']++;
                    if (m.year >= 2001) yr['2001年及以后']++;
                    if (m.year < 2001)  yr['2001年以前']++;
                });
                return { rating: cs, userScore: us, year: yr, voteCount: {}, playable: {} };
            },
            computeDyn(source) {
                const genre = {}, sentiment = {}, esrb = {};
                source.forEach(m => {
                    (m.genres || []).forEach(g => { genre[g] = (genre[g] || 0) + 1; });
                    if (m.sentiment) sentiment[m.sentiment] = (sentiment[m.sentiment] || 0) + 1;
                    if (m.esrbRating) esrb[m.esrbRating] = (esrb[m.esrbRating] || 0) + 1;
                });
                return { country: {}, genre, platform: {}, director: {}, starring: {}, sentiment, esrb };
            },
            renderExtra(state, id, renderCB, renderStaticCB) {
                const dyn = this.computeDyn(state.filteredMovies);
                const stat = this.buildStatic(state.filteredMovies);
                renderStaticCB('criticScoreFilter', stat.rating, state.selectedCriticScores, 'criticScore');
                renderStaticCB('userScoreFilter', stat.userScore, state.selectedUserScores, 'userScore');
                renderCB('sentimentFilter', dyn.sentiment, state.selectedSentiments, 'sentiment');
                renderCB('esrbFilter', dyn.esrb, state.selectedEsrbs, 'esrb');
            },
            filterExtra(item, state) {
                const matchCS = !state.selectedCriticScores.length || state.selectedCriticScores.some(v => {
                    if (v === '90+') return (item.criticScore || 0) >= 90;
                    if (v === '85+') return (item.criticScore || 0) >= 85;
                    if (v === '80+') return (item.criticScore || 0) >= 80;
                    return true;
                });
                const matchUS = !state.selectedUserScores.length || state.selectedUserScores.some(v => {
                    if (v === '9.0+') return (item.userScore || 0) >= 9.0;
                    if (v === '8.5+') return (item.userScore || 0) >= 8.5;
                    if (v === '8.0+') return (item.userScore || 0) >= 8.0;
                    return true;
                });
                const matchSentiment = !state.selectedSentiments.length || state.selectedSentiments.includes(item.sentiment);
                const matchEsrb = !state.selectedEsrbs.length || state.selectedEsrbs.includes(item.esrbRating);
                const matchGenre = !state.selectedGenres.length || state.selectedGenres.some(g => (item.genres || []).includes(g));
                return matchCS && matchUS && matchSentiment && matchEsrb && matchGenre;
            },
            renderCellFn(key, value, item) {
                if (key === 'title') {
                    const url = `https://www.metacritic.com/game/${item.slug}/`;
                    return `<td><a href="${url}" target="_blank" class="movie-title-link">${value || '-'}</a></td>`;
                }
                if (key === 'criticScore') {
                    const score = value;
                    const color = score >= 90 ? '#00A65F' : score >= 75 ? '#fc0' : '#f44';
                    return `<td><span style="font-weight:bold;color:${color}">${score ?? '-'}</span></td>`;
                }
                if (key === 'userScore') {
                    return `<td class="rating">${value != null ? Number(value).toFixed(1) : '-'}</td>`;
                }
                if (key === 'genres') {
                    return `<td class="genre">${(value || []).join(', ') || '-'}</td>`;
                }
                if (key === 'description') {
                    const text = value || '';
                    const display = text.length > 30 ? text.substring(0, 30) + '...' : text;
                    return `<td class="comment-cell" data-full-text="${text.replace(/"/g, '&quot;')}">${display || '-'}</td>`;
                }
            }
        })
};

// ── Navigation ────────────────────────────────
let currentView = 'home';

const MOVIES_VIEWS = new Set(['top250', 'imdb-top250']);
const GAMES_VIEWS = new Set(['mc-3ds-games', 'mc-nds-games', 'mc-gba-games', 'mc-psp-games', 'mc-ps1-games', 'mc-ps2-games']);
const BOOKS_VIEWS = new Set(['best-books-ever']);
const MUSIC_VIEWS = new Set(['billboard-global']);

function switchView(view) {
    document.getElementById('view-' + currentView)?.classList.remove('active');
    document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));

    currentView = view;
    document.getElementById('view-' + view)?.classList.add('active');

    if (MOVIES_VIEWS.has(view)) {
        document.getElementById('movies-dropdown-btn')?.classList.add('active');
    } else if (GAMES_VIEWS.has(view)) {
        document.getElementById('games-dropdown-btn')?.classList.add('active');
    } else if (BOOKS_VIEWS.has(view)) {
        document.getElementById('books-dropdown-btn')?.classList.add('active');
    } else if (MUSIC_VIEWS.has(view)) {
        document.getElementById('music-dropdown-btn')?.classList.add('active');
    } else {
        document.querySelectorAll('.nav-tab').forEach(t => {
            if (t.getAttribute('onclick') === `switchView('${view}')`) t.classList.add('active');
        });
    }

    if (pages[view]) pages[view].load();
}

function toggleMoviesDropdown(e) {
    e.stopPropagation();
    document.getElementById('games-dropdown-menu').classList.remove('open');
    document.getElementById('books-dropdown-menu').classList.remove('open');
    document.getElementById('music-dropdown-menu').classList.remove('open');
    document.getElementById('movies-dropdown-menu').classList.toggle('open');
}

function toggleGamesDropdown(e) {
    e.stopPropagation();
    document.getElementById('movies-dropdown-menu').classList.remove('open');
    document.getElementById('books-dropdown-menu').classList.remove('open');
    document.getElementById('music-dropdown-menu').classList.remove('open');
    document.getElementById('games-dropdown-menu').classList.toggle('open');
}

function toggleBooksDropdown(e) {
    e.stopPropagation();
    document.getElementById('movies-dropdown-menu').classList.remove('open');
    document.getElementById('games-dropdown-menu').classList.remove('open');
    document.getElementById('music-dropdown-menu').classList.remove('open');
    document.getElementById('books-dropdown-menu').classList.toggle('open');
}

function toggleMusicDropdown(e) {
    e.stopPropagation();
    document.getElementById('movies-dropdown-menu').classList.remove('open');
    document.getElementById('games-dropdown-menu').classList.remove('open');
    document.getElementById('books-dropdown-menu').classList.remove('open');
    document.getElementById('music-dropdown-menu').classList.toggle('open');
}

function closeAllDropdowns() {
    document.getElementById('movies-dropdown-menu').classList.remove('open');
    document.getElementById('games-dropdown-menu').classList.remove('open');
    document.getElementById('books-dropdown-menu').classList.remove('open');
    document.getElementById('music-dropdown-menu').classList.remove('open');
}

document.addEventListener('click', closeAllDropdowns);
