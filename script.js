// CHAVES DE API EMBUTIDAS DIRETAMENTE NO CÓDIGO
        let TMDB_API_KEY = localStorage.getItem('tmdb_api_key') || '23072480c9c99e9f8c5f652f3c3de734';
        const OMDB_API_KEY = '61e993b7';
        // Código de autorização da interface para impedir alterações acidentais da chave TMDB.
        const API_CHANGE_PASSCODE = 'C1n3via2411';

        const BASE_URL = 'https://api.themoviedb.org/3';
        const IMG_BASE_URL = 'https://image.tmdb.org/t/p/w500';

        let currentMode = 'home';
        let currentSearchQuery = '';
        let currentCategory = 'all';
        let currentPage = 1;
        let totalPages = 1;
        let currentGridItems = [];

        let searchTimeout;
        const searchInput = document.getElementById('searchInput');

        // LÓGICA DO CARROSSEL
        let heroSlides = [];
        let currentHeroSlide = 0;
        let heroInterval;

        document.addEventListener('DOMContentLoaded', () => {
            initializeVisualizationStyle();
            initHeroCarousel();
            refreshFilterGenreOptions();
            updateMyListCount();
            fetchContent();

            searchInput.addEventListener('input', (e) => {
                clearTimeout(searchTimeout);
                const query = e.target.value.trim();

                searchTimeout = setTimeout(() => {
                    if (query.length > 2) {
                        currentMode = 'search';
                        currentSearchQuery = query;
                        currentPage = 1;
                        document.getElementById('sectionTitle').innerText = `Resultados para "${query}"`;
                        hideCategories();
                        fetchContent();
                        document.querySelector('.hero').style.display = 'none';
                    } else if (query.length === 0 && currentMode === 'search') {
                        loadHome();
                    }
                }, 500);
            });
        });

        /* --- CARROSSEL EM TELA CHEIA (ESTILO IMDB) --- */
        async function initHeroCarousel() {
            if(!TMDB_API_KEY) return;
            try {
                const requests = [
                    fetch(`${BASE_URL}/trending/all/week?api_key=${TMDB_API_KEY}&language=pt-BR&page=1`).then(r => r.json()),
                    fetch(`${BASE_URL}/movie/popular?api_key=${TMDB_API_KEY}&language=pt-BR&region=BR&page=1`).then(r => r.json()),
                    fetch(`${BASE_URL}/movie/top_rated?api_key=${TMDB_API_KEY}&language=pt-BR&region=BR&page=1`).then(r => r.json()),
                    fetch(`${BASE_URL}/movie/now_playing?api_key=${TMDB_API_KEY}&language=pt-BR&region=BR&page=1`).then(r => r.json()),
                    fetch(`${BASE_URL}/tv/popular?api_key=${TMDB_API_KEY}&language=pt-BR&page=1`).then(r => r.json())
                ];

                const datasets = await Promise.all(requests);
                const seen = new Set();
                const merged = [];

                datasets.flatMap(data => data.results || []).forEach(item => {
                    const type = item.media_type || (item.first_air_date ? 'tv' : 'movie');
                    const key = `${type}-${item.id}`;
                    if (item.backdrop_path && item.poster_path && !seen.has(key)) {
                        seen.add(key);
                        merged.push({ ...item, media_type: type });
                    }
                });

                heroSlides = merged.sort((a, b) => (b.vote_average || 0) - (a.vote_average || 0)).slice(0, 31);

                const container = document.getElementById('heroCarouselContainer');
                if(heroSlides.length === 0) return;

                let slidesHTML = '';
                heroSlides.forEach((item, index) => {
                    const title = item.title || item.name;
                    const overview = item.overview || 'Explore os detalhes desta obra incrível no catálogo.';
                    const backdrop = `https://image.tmdb.org/t/p/original${item.backdrop_path}`;
                    const poster = `${IMG_BASE_URL}${item.poster_path}`;
                    const type = item.media_type === 'tv' ? 'tv' : 'movie';
                    const rating = item.vote_average ? item.vote_average.toFixed(1) : 'N/A';

                    slidesHTML += `
                        <div class="hero-slide ${index === 0 ? 'active' : ''}">
                            <div class="hero-bg" style="background-image: url('${backdrop}')"></div>
                            <div class="hero-content-wrapper">
                                <img src="${poster}" class="hero-poster" alt="${title}" onclick="openDetails(${item.id}, '${type}')" />
                                <div class="hero-text">
                                    <h1>${title}</h1>
                                    <div class="modal-tags" style="margin-bottom: 0.8rem;">
                                        <span class="tag"><i class="fa-solid fa-star" style="color:#f5c518"></i> ${rating}</span>
                                        <span class="tag">${type === 'tv' ? 'Série' : 'Filme'}</span>
                                    </div>
                                    <p>${overview}</p>
                                </div>
                            </div>
                        </div>
                    `;
                });

                container.innerHTML = slidesHTML + `
                    <div class="hero-arrows">
                        <button onclick="changeHeroSlide(-1)"><i class="fa-solid fa-chevron-left"></i></button>
                        <button onclick="changeHeroSlide(1)"><i class="fa-solid fa-chevron-right"></i></button>
                    </div>
                `;

                currentHeroSlide = 0;
                clearInterval(heroInterval);
                startHeroInterval();
            } catch (error) {
                console.error("Erro no carrossel", error);
            }
        }

        function changeHeroSlide(direction) {
            const slides = document.querySelectorAll('.hero-slide');
            if(slides.length === 0) return;

            slides[currentHeroSlide].classList.remove('active');
            currentHeroSlide = (currentHeroSlide + direction + slides.length) % slides.length;
            slides[currentHeroSlide].classList.add('active');

            resetHeroInterval();
        }

        function startHeroInterval() {
            heroInterval = setInterval(() => { changeHeroSlide(1); }, 5000);
        }

        function resetHeroInterval() {
            clearInterval(heroInterval);
            startHeroInterval();
        }

        async function fetchContent() {
            const grid = document.getElementById('resultsGrid');
            const pagination = document.getElementById('paginationContainer');
            if (!TMDB_API_KEY) return;

            grid.innerHTML = '<div class="message-box"><div class="spinner"></div><p style="margin-top:15px;">A carregar dados...</p></div>';
            pagination.style.display = 'none';

            let url = '';

            if (currentMode === 'home') {
                url = `${BASE_URL}/discover/movie?api_key=${TMDB_API_KEY}&language=pt-BR&sort_by=popularity.desc&page=${currentPage}`;
            } else if (currentMode === 'trending') {
                url = `${BASE_URL}/trending/all/week?api_key=${TMDB_API_KEY}&language=pt-BR&page=${currentPage}`;
            } else if (currentMode === 'search') {
                url = `${BASE_URL}/search/multi?api_key=${TMDB_API_KEY}&language=pt-BR&query=${encodeURIComponent(currentSearchQuery)}&page=${currentPage}`;
            } else if (currentMode === 'categories') {
                url = `${BASE_URL}/discover/movie?api_key=${TMDB_API_KEY}&language=pt-BR&with_genres=${currentCategory}&page=${currentPage}`;
            } else if (currentMode === 'mylist') {
                await fetchMyList();
                return;
            } else if (currentMode === 'recommendations') {
                await fetchRecommendations();
                return;
            } else if (currentMode === 'filters') {
                await fetchFilteredContent();
                return;
            }

            try {
                const response = await fetch(url);
                const data = await response.json();

                if (data.results && data.results.length > 0) {
                    totalPages = data.total_pages;
                    renderGrid(data.results);
                    updatePagination();
                } else {
                    grid.innerHTML = '<div class="message-box">Nenhum resultado encontrado.</div>';
                }
            } catch (error) {
                showError("Erro de conexão. Verifique sua API Key.");
            }
        }

        // --- MINHA LISTA / FAVORITOS ---
        function getFavoriteItems() {
            try { return JSON.parse(localStorage.getItem('cinevia_favorites') || '[]'); } catch { return []; }
        }

        function updateMyListCount() {
            const el = document.getElementById('myListCount');
            if (el) el.textContent = getFavoriteItems().length ? `(${getFavoriteItems().length})` : '';
        }

        function isFavorite(id, type) {
            return getFavoriteItems().some(item => Number(item.id) === Number(id) && item.type === type);
        }

        function toggleFavorite(id, type, title = '') {
            const favorites = getFavoriteItems();
            const index = favorites.findIndex(item => Number(item.id) === Number(id) && item.type === type);
            if (index >= 0) favorites.splice(index, 1);
            else favorites.unshift({ id: Number(id), type, title });
            localStorage.setItem('cinevia_favorites', JSON.stringify(favorites.slice(0, 50)));
            updateMyListCount();
            renderCurrentListState();
            const modal = document.getElementById('detailsModal');
            if (modal?.classList.contains('active') && modal.querySelector('.modal-title')) {
                // Atualiza apenas o conteúdo atual do modal para refletir o estado do favorito.
                openDetails(id, type);
            }
        }

        function renderCurrentListState() {
            if (currentMode === 'mylist') fetchContent();
        }

        async function fetchMyList() {
            const grid = document.getElementById('resultsGrid');
            const pagination = document.getElementById('paginationContainer');
            pagination.style.display = 'none';
            const favorites = getFavoriteItems();
            if (!favorites.length) {
                grid.innerHTML = '<div class="message-box"><i class="fa-regular fa-heart" style="font-size:2rem;color:var(--accent);margin-bottom:12px;"></i><br>Sua Minha Lista está vazia.<br><span style="font-size:0.9rem;">Adicione filmes e séries usando o coração.</span></div>';
                return;
            }
            try {
                const results = await Promise.all(favorites.slice(0, 30).map(async item => {
                    const response = await fetch(`${BASE_URL}/${item.type}/${item.id}?api_key=${TMDB_API_KEY}&language=pt-BR`);
                    const data = await response.json();
                    return { ...data, media_type: item.type };
                }));
                renderGrid(results.filter(item => item && item.id));
            } catch (error) {
                showError('Não foi possível carregar sua Minha Lista.');
            }
        }

        // --- RECOMENDAÇÕES ---
        async function fetchRecommendations() {
            const grid = document.getElementById('resultsGrid');
            const pagination = document.getElementById('paginationContainer');
            pagination.style.display = 'none';
            const favorites = getFavoriteItems();
            try {
                let pool = [];
                const seeds = favorites.slice(0, 5);
                if (seeds.length) {
                    const responses = await Promise.all(seeds.map(item => fetch(`${BASE_URL}/${item.type}/${item.id}/recommendations?api_key=${TMDB_API_KEY}&language=pt-BR&page=1`).then(r => r.json()).catch(() => ({results:[]}))));
                    responses.forEach(data => { pool.push(...(data.results || [])); });
                } else {
                    const trending = await fetch(`${BASE_URL}/trending/all/week?api_key=${TMDB_API_KEY}&language=pt-BR&page=1`).then(r => r.json());
                    pool = trending.results || [];
                }
                const seen = new Set(favorites.map(item => `${item.type}-${item.id}`));
                const unique = [];
                pool.forEach(item => {
                    const type = item.media_type || (item.title ? 'movie' : 'tv');
                    const key = `${type}-${item.id}`;
                    if (!seen.has(key) && !unique.some(x => `${x.media_type}-${x.id}` === key) && (item.poster_path || item.backdrop_path)) {
                        unique.push({ ...item, media_type: type });
                    }
                });
                const sorted = unique.sort((a,b) => (b.vote_average || 0) - (a.vote_average || 0)).slice(0, 24);
                if (!sorted.length) {
                    grid.innerHTML = '<div class="message-box">Ainda não há recomendações suficientes.</div>';
                    return;
                }
                renderGrid(sorted);
            } catch (error) {
                showError('Não foi possível gerar recomendações agora.');
            }
        }

        // --- FILTROS AVANÇADOS ---
        const movieGenreOptions = [
            ['', 'Todos'], ['28|10759', 'Ação / Ação e Aventura'], ['12|10759', 'Aventura'], ['16|16', 'Animação'], ['35|35', 'Comédia'], ['80|80', 'Crime'], ['99|99', 'Documentário'], ['18|18', 'Drama'], ['10751|10751', 'Família'], ['14|10765', 'Fantasia'], ['27|', 'Terror'], ['9648|9648', 'Mistério'], ['878|10765', 'Ficção Científica'], ['10749|10749', 'Romance'], ['37|37', 'Faroeste']
        ];

        function refreshFilterGenreOptions() {
            const select = document.getElementById('filterGenre');
            if (!select) return;
            const type = document.getElementById('filterType')?.value || 'all';
            select.innerHTML = movieGenreOptions.map(([value, label]) => {
                if (type === 'tv' && value === '27|') return '';
                const actual = type === 'movie' ? (value.split('|')[0] || '') : type === 'tv' ? (value.split('|')[1] || '') : value;
                return `<option value="${actual}">${label}</option>`;
            }).join('');
        }

        function toggleFilters() {
            document.getElementById('filterPanel')?.classList.toggle('active');
        }

        function resetFilters() {
            document.getElementById('filterType').value = 'all';
            document.getElementById('filterFromYear').value = '';
            document.getElementById('filterToYear').value = '';
            document.getElementById('filterRating').value = '';
            document.getElementById('filterLanguage').value = '';
            document.getElementById('filterSort').value = 'popularity.desc';
            document.getElementById('filterVotes').value = '';
            refreshFilterGenreOptions();
            document.getElementById('filterGenre').value = '';
        }

        function applyFilters() {
            currentMode = 'filters';
            currentPage = 1;
            currentSearchQuery = '';
            searchInput.value = '';
            document.querySelector('.hero').style.display = 'none';
            hideCategories();
            setActiveNav('navHome');
            document.getElementById('sectionTitle').innerText = 'Resultados filtrados';
            fetchContent();
        }

        async function fetchFilteredContent() {
            const grid = document.getElementById('resultsGrid');
            const pagination = document.getElementById('paginationContainer');
            const type = document.getElementById('filterType').value;
            const genre = document.getElementById('filterGenre').value;
            const fromYear = document.getElementById('filterFromYear').value;
            const toYear = document.getElementById('filterToYear').value;
            const rating = document.getElementById('filterRating').value;
            const language = document.getElementById('filterLanguage').value;
            const sort = document.getElementById('filterSort').value;
            const votes = document.getElementById('filterVotes').value;
            const requests = [];
            const genreParts = genre ? genre.split('|') : ['', ''];
            const movieGenre = genreParts[0] || '';
            const tvGenre = genreParts[1] || '';

            const buildMovie = () => {
                const params = new URLSearchParams({ api_key: TMDB_API_KEY, language: 'pt-BR', region: 'BR', page: String(currentPage), sort_by: sort });
                if (movieGenre) params.set('with_genres', movieGenre);
                if (fromYear) params.set('primary_release_date.gte', `${fromYear}-01-01`);
                if (toYear) params.set('primary_release_date.lte', `${toYear}-12-31`);
                if (rating) params.set('vote_average.gte', rating);
                if (language) params.set('with_original_language', language);
                if (votes) params.set('vote_count.gte', votes);
                return fetch(`${BASE_URL}/discover/movie?${params}`).then(r => r.json());
            };
            const buildTv = () => {
                let tvSort = sort === 'primary_release_date.desc' ? 'first_air_date.desc' : sort;
                const params = new URLSearchParams({ api_key: TMDB_API_KEY, language: 'pt-BR', page: String(currentPage), sort_by: tvSort });
                if (tvGenre) params.set('with_genres', tvGenre);
                if (fromYear) params.set('first_air_date.gte', `${fromYear}-01-01`);
                if (toYear) params.set('first_air_date.lte', `${toYear}-12-31`);
                if (rating) params.set('vote_average.gte', rating);
                if (language) params.set('with_original_language', language);
                if (votes) params.set('vote_count.gte', votes);
                return fetch(`${BASE_URL}/discover/tv?${params}`).then(r => r.json());
            };

            if (type === 'movie') requests.push(buildMovie());
            else if (type === 'tv') requests.push(buildTv());
            else { requests.push(buildMovie()); requests.push(buildTv()); }

            try {
                const datasets = await Promise.all(requests);
                const results = [];
                let maxPages = 1;
                datasets.forEach((data, idx) => {
                    maxPages = Math.max(maxPages, data.total_pages || 1);
                    (data.results || []).forEach(item => results.push({ ...item, media_type: idx === 0 && type !== 'all' ? type : (idx === 0 ? 'movie' : 'tv') }));
                });
                results.sort((a,b) => (b.popularity || 0) - (a.popularity || 0));
                totalPages = Math.min(maxPages, 500);
                renderGrid(results);
                updatePagination();
            } catch (error) {
                showError('Não foi possível aplicar os filtros.');
            }
        }

        // --- CINÉVIA SCORE ---
        function calculateCineviaScore(item) {
            const rating = Number(item.vote_average || 0);
            const votes = Number(item.vote_count || 0);
            const popularity = Number(item.popularity || 0);
            const ratingBase = Math.min(100, Math.max(0, rating * 10));
            const confidence = Math.min(100, Math.log10(votes + 1) / 4 * 100);
            const popularityBonus = Math.min(100, Math.log10(popularity + 1) / 3 * 100);
            const score = (ratingBase * 0.72) + (confidence * 0.18) + (popularityBonus * 0.10);
            return Math.round(score);
        }

        // --- TRAILERS ---
        function findBestTrailer(videos) {
            const usable = (videos || []).filter(v => v.site === 'YouTube' && v.key && ['Trailer','Teaser'].includes(v.type));
            if (!usable.length) return null;
            return usable.sort((a,b) => Number(Boolean(b.official)) - Number(Boolean(a.official)) || (a.type === 'Trailer' ? -1 : 1))[0];
        }

        // Mantém uma lista de opções para o caso de um vídeo não permitir incorporação.
        let trailerCandidates = [];
        let trailerCandidateIndex = 0;
        let trailerPlayer = null;
        let trailerOpenRequestId = 0;
        let youtubeIframeApiPromise = null;
        let currentTrailerTitle = 'Trailer';

        function getTrailerCandidates(videos) {
            return (videos || [])
                .filter(video => video.site === 'YouTube' && video.key && ['Trailer', 'Teaser'].includes(video.type))
                .sort((a, b) =>
                    Number(Boolean(b.official)) - Number(Boolean(a.official)) ||
                    Number(b.type === 'Trailer') - Number(a.type === 'Trailer') ||
                    Number(b.iso_639_1 === 'pt') - Number(a.iso_639_1 === 'pt')
                );
        }

        function loadYouTubeIframeAPI() {
            if (window.YT && window.YT.Player) return Promise.resolve(window.YT);
            if (youtubeIframeApiPromise) return youtubeIframeApiPromise;

            youtubeIframeApiPromise = new Promise((resolve, reject) => {
                const scriptUrl = 'https://www.youtube.com/iframe_api';
                const existingScript = Array.from(document.scripts).find(script => script.src === scriptUrl);
                const previousCallback = window.onYouTubeIframeAPIReady;

                window.onYouTubeIframeAPIReady = function () {
                    if (typeof previousCallback === 'function') {
                        try { previousCallback(); } catch (error) { console.error('Erro no callback anterior do player do YouTube:', error); }
                    }
                    if (window.YT && window.YT.Player) resolve(window.YT);
                    else {
                        youtubeIframeApiPromise = null;
                        reject(new Error('A API do player do YouTube não foi inicializada.'));
                    }
                };

                if (!existingScript) {
                    const script = document.createElement('script');
                    script.src = scriptUrl;
                    script.async = true;
                    script.onerror = () => {
                        script.remove();
                        youtubeIframeApiPromise = null;
                        reject(new Error('Não foi possível carregar a API do player do YouTube.'));
                    };
                    document.head.appendChild(script);
                }
            });

            return youtubeIframeApiPromise;
        }

        function destroyTrailerPlayer() {
            if (trailerPlayer && typeof trailerPlayer.destroy === 'function') {
                try { trailerPlayer.destroy(); } catch (error) { /* O player pode já ter sido removido pelo navegador. */ }
            }
            trailerPlayer = null;
        }

        function showTrailerFallback(message, trailer = trailerCandidates[trailerCandidateIndex]) {
            const wrap = document.getElementById('trailerFrameWrap');
            if (!wrap) return;
            destroyTrailerPlayer();
            wrap.innerHTML = '';

            const messageBox = document.createElement('div');
            messageBox.className = 'trailer-message';
            messageBox.style.minHeight = '100%';
            messageBox.style.display = 'flex';
            messageBox.style.flexDirection = 'column';
            messageBox.style.alignItems = 'center';
            messageBox.style.justifyContent = 'center';
            messageBox.style.gap = '1rem';
            messageBox.textContent = message;

            if (trailer && trailer.key) {
                const alternativeLink = document.createElement('a');
                alternativeLink.href = `https://www.youtube.com/watch?v=${encodeURIComponent(trailer.key)}`;
                alternativeLink.target = '_blank';
                alternativeLink.rel = 'noopener noreferrer';
                alternativeLink.className = 'trailer-fallback-link';
                alternativeLink.textContent = 'Abrir este trailer no YouTube';
                alternativeLink.style.display = 'inline-flex';
                alternativeLink.style.alignItems = 'center';
                alternativeLink.style.justifyContent = 'center';
                alternativeLink.style.marginTop = '0.25rem';
                alternativeLink.style.padding = '10px 16px';
                alternativeLink.style.borderRadius = '7px';
                alternativeLink.style.background = 'var(--accent)';
                alternativeLink.style.color = '#fff';
                alternativeLink.style.fontWeight = '800';
                alternativeLink.style.textDecoration = 'none';
                messageBox.appendChild(alternativeLink);
            }

            wrap.appendChild(messageBox);
        }

        function handleTrailerPlayerError(event, requestId) {
            if (requestId !== trailerOpenRequestId || !document.getElementById('trailerOverlay')?.classList.contains('active')) return;

            const errorCode = Number(event.data);
            const failedTrailer = trailerCandidates[trailerCandidateIndex];

            // Erros do vídeo (removido, inválido ou incorporação bloqueada): tenta outro trailer/teaser do TMDB.
            if ([2, 5, 100, 101, 150].includes(errorCode) && trailerCandidateIndex < trailerCandidates.length - 1) {
                trailerCandidateIndex++;
                const nextTrailer = trailerCandidates[trailerCandidateIndex];
                try {
                    if (trailerPlayer && typeof trailerPlayer.loadVideoById === 'function') {
                        trailerPlayer.loadVideoById(nextTrailer.key);
                        return;
                    }
                } catch (error) {
                    console.warn('Não foi possível carregar o próximo trailer incorporado:', error);
                }
            }

            if (errorCode === 153) {
                const message = window.location.protocol === 'file:'
                    ? 'O Cinévia foi aberto diretamente como arquivo local. O YouTube pode exigir um endereço HTTP/HTTPS para reproduzir o vídeo incorporado. Abra o projeto com um servidor local (por exemplo, Live Server) ou publique o site.'
                    : 'O YouTube não recebeu as informações de origem necessárias para o player incorporado. Verifique se o site está aberto por HTTP/HTTPS e se o navegador não está bloqueando essas informações.';
                showTrailerFallback(message, failedTrailer);
                return;
            }

            if ([101, 150].includes(errorCode)) {
                showTrailerFallback('Os trailers disponíveis encontrados para este filme não permitem reprodução incorporada. Isso é definido pelo responsável pelo vídeo.', trailerCandidates[trailerCandidateIndex]);
            } else if (errorCode === 100) {
                showTrailerFallback('Os trailers disponíveis estão removidos, privados ou indisponíveis para reprodução incorporada.', trailerCandidates[trailerCandidateIndex]);
            } else {
                showTrailerFallback('Não foi possível reproduzir este trailer dentro do Cinévia. O vídeo pode estar indisponível ou bloquear a incorporação.', trailerCandidates[trailerCandidateIndex] || failedTrailer);
            }
        }

        function createTrailerPlayer(requestId) {
            const wrap = document.getElementById('trailerFrameWrap');
            const trailer = trailerCandidates[trailerCandidateIndex];
            if (!wrap || !trailer || requestId !== trailerOpenRequestId) return;

            wrap.innerHTML = '';
            const iframe = document.createElement('iframe');
            iframe.id = 'cineviaYouTubePlayer';
            iframe.className = 'trailer-frame';
            const playerParams = new URLSearchParams({ autoplay: '1', enablejsapi: '1', rel: '0', playsinline: '1' });
            if (window.location.protocol === 'http:' || window.location.protocol === 'https:') {
                playerParams.set('origin', window.location.origin);
            }
            iframe.src = `https://www.youtube.com/embed/${encodeURIComponent(trailer.key)}?${playerParams.toString()}`;
            iframe.title = `${currentTrailerTitle} — Trailer`;
            iframe.allow = 'autoplay; encrypted-media; picture-in-picture; web-share';
            iframe.allowFullscreen = true;
            iframe.referrerPolicy = 'strict-origin-when-cross-origin';
            wrap.appendChild(iframe);

            trailerPlayer = new YT.Player(iframe, {
                events: {
                    onError: event => handleTrailerPlayerError(event, requestId)
                }
            });
        }

        async function openTrailer(movieId, title = '') {
            currentTrailerTitle = title || document.querySelector('#modalContent .modal-title')?.textContent?.trim() || 'Trailer';
            const overlay = document.getElementById('trailerOverlay');
            const wrap = document.getElementById('trailerFrameWrap');
            const requestId = ++trailerOpenRequestId;

            destroyTrailerPlayer();
            trailerCandidates = [];
            trailerCandidateIndex = 0;
            document.getElementById('trailerTitle').textContent = `Trailer — ${currentTrailerTitle}`;
            wrap.innerHTML = '<div class="trailer-message"><div class="spinner"></div><p style="margin-top:12px;">Carregando trailer...</p></div>';
            overlay.classList.add('active');

            try {
                const response = await fetch(`${BASE_URL}/movie/${movieId}/videos?api_key=${TMDB_API_KEY}&language=pt-BR&include_video_language=pt-BR,en-US,null`);
                if (!response.ok) throw new Error('Não foi possível consultar os trailers no TMDB.');
                const data = await response.json();
                if (requestId !== trailerOpenRequestId) return;

                trailerCandidates = getTrailerCandidates(data.results || []);
                if (!trailerCandidates.length) {
                    wrap.innerHTML = '<div class="trailer-message">Este filme não possui um trailer disponível no TMDB.</div>';
                    return;
                }

                await loadYouTubeIframeAPI();
                if (requestId !== trailerOpenRequestId || !overlay.classList.contains('active')) return;
                createTrailerPlayer(requestId);
            } catch (error) {
                if (requestId !== trailerOpenRequestId) return;
                showTrailerFallback('Não foi possível iniciar o player incorporado. Verifique sua conexão e tente novamente.', trailerCandidates[0]);
            }
        }

        function closeTrailer(event) {
            if (event && event.target && !event.target.classList.contains('trailer-overlay')) return;
            trailerOpenRequestId++;
            const overlay = document.getElementById('trailerOverlay');
            const wrap = document.getElementById('trailerFrameWrap');
            overlay.classList.remove('active');
            destroyTrailerPlayer();
            trailerCandidates = [];
            trailerCandidateIndex = 0;
            wrap.innerHTML = '';
        }

        // --- SURPREENDA-ME ---
        async function surpriseMe() {
            try {
                const data = await fetch(`${BASE_URL}/trending/all/week?api_key=${TMDB_API_KEY}&language=pt-BR&page=1`).then(r => r.json());
                const choices = (data.results || []).filter(item => item.poster_path && (item.media_type === 'movie' || item.media_type === 'tv'));
                if (!choices.length) return;
                const pick = choices[Math.floor(Math.random() * choices.length)];
                openDetails(pick.id, pick.media_type);
            } catch (error) {
                showError('Não foi possível escolher uma recomendação agora.');
            }
        }

        function renderGrid(items) {
            const grid = document.getElementById('resultsGrid');
            currentGridItems = Array.isArray(items) ? items : [];
            items = currentGridItems;
            grid.innerHTML = '';
            const useNetflixStyle = document.body.classList.contains('netflix-look');

            items.forEach(item => {
                if (!item.poster_path && !item.profile_path) return;

                const title = item.title || item.name;
                const date = item.release_date || item.first_air_date || '';
                const year = date ? date.split('-')[0] : 'N/A';
                const rating = item.vote_average ? item.vote_average.toFixed(1) : 'NR';
                const imagePath = (useNetflixStyle && item.backdrop_path) ? item.backdrop_path : (item.poster_path || item.profile_path);
                const imageBase = (useNetflixStyle && item.backdrop_path) ? 'https://image.tmdb.org/t/p/w780' : IMG_BASE_URL;
                const mediaType = item.media_type || (item.title ? 'movie' : 'tv');

                const card = document.createElement('div');
                card.className = 'card';
                card.onclick = () => openDetails(item.id, mediaType);

                card.innerHTML = `
                    <div class="card-img-wrapper">
                        <button class="favorite-btn ${isFavorite(item.id, mediaType) ? 'active' : ''}" onclick="event.stopPropagation(); toggleFavorite(${item.id}, '${mediaType}');"><i class="fa-${isFavorite(item.id, mediaType) ? 'solid' : 'regular'} fa-heart"></i></button>
                        <img src="${imageBase}${imagePath}" alt="${title}" class="card-img" loading="lazy">
                        ${rating !== 'NR' ? `<div class="rating-badge"><i class="fa-solid fa-star"></i> ${rating}</div>` : ''}
                    </div>
                    <div class="card-info">
                        <h3 class="card-title">${title}</h3>
                        <div class="card-meta">${year} • ${mediaType === 'tv' ? 'Série' : 'Filme'} • <span class="cinevia-score">CV ${calculateCineviaScore(item)}</span></div>
                    </div>
                `;
                grid.appendChild(card);
            });
        }

        /* --- DETALHES + INTEGRAÇÃO TMDB & OMDB + ONDE ASSISTIR --- */
        async function openDetails(id, type) {
            if (type === 'person') return;

            const modal = document.getElementById('detailsModal');
            const content = document.getElementById('modalContent');
            content.innerHTML = '<div style="padding: 4rem; width: 100%; text-align: center;"><div class="spinner"></div></div>';
            modal.classList.add('active');

            try {
                const detailsUrl = `${BASE_URL}/${type}/${id}?api_key=${TMDB_API_KEY}&language=pt-BR&append_to_response=release_dates,content_ratings,watch/providers,external_ids,credits,videos&include_video_language=pt-BR,en-US,null`;
                const res = await fetch(detailsUrl);
                const data = await res.json();

                let omdbData = null;
                const imdbId = data.imdb_id || data.external_ids?.imdb_id;
                if (imdbId && OMDB_API_KEY) {
                    try {
                        const omdbRes = await fetch(`https://www.omdbapi.com/?apikey=${OMDB_API_KEY}&i=${imdbId}`);
                        omdbData = await omdbRes.json();
                    } catch(e) { console.error("Erro ao buscar dados do OMDb:", e); }
                }

                renderModal(data, type, omdbData);
            } catch (error) {
                content.innerHTML = '<div style="padding: 2rem; color: white;">Erro ao carregar detalhes.</div>';
            }
        }

        function renderModal(data, type, omdbData = null) {
            const content = document.getElementById('modalContent');
            const title = data.title || data.name;
            const overview = data.overview || 'Sinopse não disponível em português.';
            const poster = data.poster_path ? `${IMG_BASE_URL}${data.poster_path}` : 'https://via.placeholder.com/500x750?text=Sem+Imagem';

            const releaseDate = data.release_date || data.first_air_date || 'N/A';
            const year = releaseDate !== 'N/A' ? releaseDate.split('-')[0] : 'N/A';

            const duration = data.runtime ? `${data.runtime} min` : (data.episode_run_time && data.episode_run_time[0] ? `${data.episode_run_time[0]} min` : 'N/A');
            const status = data.status || 'N/A';

            let ageRating = 'Livre';
            let ageColor = '#4ade80';

            if (type === 'movie' && data.release_dates && data.release_dates.results) {
                const brRelease = data.release_dates.results.find(r => r.iso_3166_1 === 'BR');
                if (brRelease && brRelease.release_dates[0]?.certification) ageRating = brRelease.release_dates[0].certification;
            } else if (type === 'tv' && data.content_ratings && data.content_ratings.results) {
                const brRating = data.content_ratings.results.find(r => r.iso_3166_1 === 'BR');
                if (brRating) ageRating = brRating.rating;
            }

            if(ageRating === '18') ageColor = '#ef4444';
            else if(ageRating === '16') ageColor = '#f97316';
            else if(ageRating === '14' || ageRating === '12') ageColor = '#eab308';
            else if(ageRating === '10') ageColor = '#3b82f6';

            const genres = data.genres ? data.genres.map(g => `<span class="tag">${g.name}</span>`).join('') : '';

            let scoresHtml = `
                <div class="score-badge">
                    <i class="fa-solid fa-star" style="color: #f5c518"></i> TMDB: ${data.vote_average ? data.vote_average.toFixed(1) : 'N/A'}
                </div>
                <div class="score-badge">
                    <i class="fa-solid fa-clapperboard" style="color:#8bd17c"></i> Cinévia Score: <span class="cinevia-score">${calculateCineviaScore(data)}/100</span>
                </div>
            `;

            if (omdbData && omdbData.Response !== "False") {
                if (omdbData.imdbRating && omdbData.imdbRating !== 'N/A') {
                    scoresHtml += `
                        <div class="score-badge">
                            <i class="fa-brands fa-imdb" style="color: #f5c518"></i> IMDb: ${omdbData.imdbRating}
                        </div>
                    `;
                }
                if (omdbData.Ratings) {
                    const rt = omdbData.Ratings.find(r => r.Source === 'Rotten Tomatoes');
                    if (rt) {
                        scoresHtml += `
                            <div class="score-badge">
                                <i class="fa-solid fa-apple-whole" style="color: #fa320a"></i> Rotten: ${rt.Value}
                            </div>
                        `;
                    }
                }
            }

            let providersHtml = '';
            const watchProviders = data['watch/providers']?.results?.BR;
            if (watchProviders && (watchProviders.flatrate || watchProviders.rent || watchProviders.buy)) {
                const list = watchProviders.flatrate || watchProviders.rent || watchProviders.buy;
                const logosHtml = list.map(p => `<img src="${IMG_BASE_URL}${p.logo_path}" alt="${p.provider_name}" title="${p.provider_name}" class="provider-logo">`).join('');
                providersHtml = `
                    <div class="streaming-providers">
                        <span class="streaming-title">Disponível em:</span>
                        <div class="provider-logos">${logosHtml}</div>
                    </div>
                `;
            }

            // Informações adicionais de filmes: orçamento, receita, diretor e escritores.
            let advancedHtml = '';
            if (type === 'movie') {
                const director = (data.credits?.crew || []).filter(p => p.job === 'Director').map(p => p.name).filter((v, i, a) => a.indexOf(v) === i).join(', ') || 'Não informado';
                const writers = (data.credits?.crew || []).filter(p => ['Writer', 'Screenplay', 'Story'].includes(p.job)).map(p => p.name).filter((v, i, a) => a.indexOf(v) === i).join(', ') || 'Não informado';
                const budget = data.budget ? `US$ ${Number(data.budget).toLocaleString('en-US')}` : 'Não informado';
                const revenue = data.revenue ? `US$ ${Number(data.revenue).toLocaleString('en-US')}` : 'Não informado';
                const isFav = isFavorite(data.id, 'movie');
                const score = calculateCineviaScore(data);
                const trailerExists = findBestTrailer(data.videos?.results || []) !== null;
                const castPeople = (data.credits?.cast || []).filter(p => p.profile_path).slice(0, 12);
                advancedHtml = `
                    <details class="expandable-details">
                        <summary>Mais informações do filme</summary>
                        <div class="expandable-body">
                            <div class="feature-actions">
                                <button class="feature-btn ${trailerExists ? '' : 'disabled'}" ${trailerExists ? `onclick="openTrailer(${data.id})"` : 'disabled'}><i class="fa-solid fa-play"></i> ${trailerExists ? 'Assistir trailer' : 'Trailer indisponível'}</button>
                                <button class="favorite-detail-btn ${isFav ? 'active' : ''}" onclick="toggleFavorite(${data.id}, 'movie')"><i class="fa-${isFav ? 'solid' : 'regular'} fa-heart"></i> ${isFav ? 'Na Minha Lista' : 'Minha Lista'}</button>
                            </div>
                            <div class="crew-grid">
                                <div class="crew-item"><span>Diretor</span><strong>${director}</strong></div>
                                <div class="crew-item"><span>Escritor(es)</span><strong>${writers}</strong></div>
                                <div class="crew-item"><span>Orçamento</span><strong>${budget}</strong></div>
                                <div class="crew-item"><span>Receita</span><strong>${revenue}</strong></div>
                            </div>
                            <div class="crew-item"><span>Cinévia Score</span><strong class="cinevia-score">${score}/100</strong></div>
                        </div>
                    </details>
                `;
                if (castPeople.length) {
                    advancedHtml += `
                        <details class="expandable-details">
                            <summary>Elenco</summary>
                            <div class="expandable-body">
                                <div class="cast-grid">
                                    ${castPeople.map(p => `<div class="cast-card"><img class="cast-img" src="https://image.tmdb.org/t/p/w185${p.profile_path}" alt="${p.name}" loading="lazy"><div><div class="cast-name">${p.name}</div><div class="cast-character">${p.character || 'Personagem não informado'}</div></div></div>`).join('')}
                                </div>
                            </div>
                        </details>
                    `;
                }
            } else {
                const creators = data.created_by?.map(p => p.name).join(', ') || 'Não informado';
                const isFav = isFavorite(data.id, 'tv');
                const score = calculateCineviaScore(data);
                advancedHtml = `
                    <details class="expandable-details" id="episodesDetails" ontoggle="handleEpisodesToggle(${data.id}, this)">
                        <summary>Episódios e avaliações</summary>
                        <div class="expandable-body">
                            <div class="feature-actions">
                                <button class="favorite-detail-btn ${isFav ? 'active' : ''}" onclick="toggleFavorite(${data.id}, 'tv')"><i class="fa-${isFav ? 'solid' : 'regular'} fa-heart"></i> ${isFav ? 'Na Minha Lista' : 'Minha Lista'}</button>
                            </div>
                            <div class="crew-grid">
                                <div class="crew-item"><span>Criador(es)</span><strong>${creators}</strong></div>
                                <div class="crew-item"><span>Temporadas</span><strong>${data.number_of_seasons ?? 'N/A'}</strong></div>
                                <div class="crew-item"><span>Episódios</span><strong>${data.number_of_episodes ?? 'N/A'}</strong></div>
                                <div class="crew-item"><span>Status</span><strong>${status}</strong></div>
                            </div>
                            <div class="crew-item"><span>Cinévia Score</span><strong class="cinevia-score">${score}/100</strong></div>
                            <div class="episodes-toolbar">
                                <div>
                                    <span class="episode-select-label">Temporada</span>
                                    <select class="season-select" id="seasonSelect_${data.id}" onchange="loadSeasonEpisodes(${data.id}, this.value)">
                                        ${(data.seasons || []).map(s => `<option value="${s.season_number}">${s.name}</option>`).join('')}
                                    </select>
                                </div>
                            </div>
                            <div class="episode-grid" id="episodeGrid_${data.id}"><div class="episode-loading"><div class="spinner"></div><p style="margin-top:10px;">Selecione uma temporada para ver os episódios.</p></div></div>
                        </div>
                    </details>
                `;
                const castPeople = (data.credits?.cast || []).filter(p => p.profile_path).slice(0, 12);
                if (castPeople.length) {
                    advancedHtml += `
                        <details class="expandable-details">
                            <summary>Elenco</summary>
                            <div class="expandable-body">
                                <div class="cast-grid">
                                    ${castPeople.map(p => `<div class="cast-card"><img class="cast-img" src="https://image.tmdb.org/t/p/w185${p.profile_path}" alt="${p.name}" loading="lazy"><div><div class="cast-name">${p.name}</div><div class="cast-character">${p.character || 'Personagem não informado'}</div></div></div>`).join('')}
                                </div>
                            </div>
                        </details>
                    `;
                }
            }

            content.innerHTML = `
                <button class="modal-close" onclick="forceCloseModal()"><i class="fa-solid fa-xmark"></i></button>
                <img src="${poster}" alt="${title}" class="modal-img">
                <div class="modal-info">
                    <h2 class="modal-title">${title}</h2>

                    <div class="modal-tags">
                        <span class="age-rating" style="background-color: ${ageColor}">${ageRating}</span>
                        ${genres}
                    </div>

                    <div class="external-scores">
                        ${scoresHtml}
                    </div>

                    ${providersHtml}

                    <p class="modal-desc">${overview}</p>

                    <div class="modal-meta-grid">
                        <div class="meta-item"><span>Lançamento</span> ${year}</div>
                        <div class="meta-item"><span>Duração</span> ${duration}</div>
                        <div class="meta-item"><span>Tipo</span> ${type === 'tv' ? 'Série de TV' : 'Filme'}</div>
                        <div class="meta-item"><span>Status</span> ${status}</div>
                    </div>

                    <div class="feature-actions">
                        <button class="favorite-detail-btn ${isFavorite(data.id, type) ? 'active' : ''}" onclick="toggleFavorite(${data.id}, '${type}')"><i class="fa-${isFavorite(data.id, type) ? 'solid' : 'regular'} fa-heart"></i> ${isFavorite(data.id, type) ? 'Na Minha Lista' : 'Adicionar à Minha Lista'}</button>
                    </div>

                    ${advancedHtml}
                </div>
            `;

            // Info, episódios e elenco são painéis exclusivos: apenas um pode ficar aberto.
            const expandableItems = Array.from(content.querySelectorAll('.expandable-details'));
            expandableItems.forEach(details => {
                details.addEventListener('toggle', () => {
                    const body = details.querySelector('.expandable-body');
                    if (!details.open) {
                        body?.classList.remove('is-overflowing');
                        return;
                    }

                    expandableItems.forEach(other => {
                        if (other !== details && other.open) {
                            other.open = false;
                            other.querySelector('.expandable-body')?.classList.remove('is-overflowing');
                        }
                    });

                    if (body) {
                        body.classList.remove('is-overflowing');
                        requestAnimationFrame(() => {
                            if (!details.open || !body.isConnected || getComputedStyle(body).position !== 'absolute') return;
                            const bounds = body.getBoundingClientRect();
                            if (bounds.right > window.innerWidth - 12 || bounds.left < 12) {
                                body.classList.add('is-overflowing');
                            }
                        });
                    }
                });
            });
        }

        async function handleEpisodesToggle(id, detailsEl) {
            if (!detailsEl.open) return;
            const select = document.getElementById(`seasonSelect_${id}`);
            if (!select || !select.value) return;
            const grid = document.getElementById(`episodeGrid_${id}`);
            if (grid.dataset.loaded !== select.value) {
                await loadSeasonEpisodes(id, select.value);
            }
        }

        async function loadSeasonEpisodes(tvId, seasonNumber) {
            const grid = document.getElementById(`episodeGrid_${tvId}`);
            if (!grid || !TMDB_API_KEY || !seasonNumber) return;

            grid.innerHTML = '<div class="episode-loading"><div class="spinner"></div><p style="margin-top:10px;">Carregando episódios...</p></div>';
            try {
                const response = await fetch(`${BASE_URL}/tv/${tvId}/season/${seasonNumber}?api_key=${TMDB_API_KEY}&language=pt-BR`);
                const data = await response.json();
                const episodes = data.episodes || [];

                if (!episodes.length) {
                    grid.innerHTML = '<div class="episode-loading">Nenhum episódio encontrado para esta temporada.</div>';
                    return;
                }

                grid.innerHTML = episodes.map(ep => {
                    const still = ep.still_path ? `https://image.tmdb.org/t/p/w300${ep.still_path}` : 'https://via.placeholder.com/300x450?text=Sem+Imagem';
                    const rating = ep.vote_average ? ep.vote_average.toFixed(1) : 'N/A';
                    const airDate = ep.air_date ? ep.air_date.split('-').reverse().join('/') : 'N/A';
                    const overview = ep.overview || 'Sem sinopse disponível.';
                    return `
                        <article class="episode-card">
                            <img class="episode-img" src="${still}" alt="${ep.name || `Episódio ${ep.episode_number}`}" loading="lazy">
                            <div class="episode-content">
                                <div class="episode-number">EP. ${ep.episode_number}</div>
                                <div class="episode-title">${ep.name || 'Episódio sem título'}</div>
                                <div class="episode-meta"><span class="episode-rating"><i class="fa-solid fa-star"></i> ${rating}</span><span>${airDate}</span></div>
                                <div class="episode-overview">${overview}</div>
                            </div>
                        </article>
                    `;
                }).join('');
                grid.dataset.loaded = String(seasonNumber);
            } catch (error) {
                console.error('Erro ao carregar episódios:', error);
                grid.innerHTML = '<div class="episode-loading" style="color:#ef4444;">Não foi possível carregar os episódios.</div>';
            }
        }

        // --- NAVEGAÇÃO E ESTADOS ---
        function setActiveNav(id) {
            document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
            document.getElementById(id).classList.add('active');
        }

        function loadMyList() {
            currentMode = 'mylist';
            currentPage = 1;
            searchInput.value = '';
            document.getElementById('sectionTitle').innerText = 'Minha Lista';
            document.querySelector('.hero').style.display = 'none';
            setActiveNav('navMyList');
            hideCategories();
            fetchContent();
        }

        function loadRecommendations() {
            currentMode = 'recommendations';
            currentPage = 1;
            searchInput.value = '';
            document.getElementById('sectionTitle').innerText = 'Recomendados para você';
            document.querySelector('.hero').style.display = 'none';
            setActiveNav('navRecommendations');
            hideCategories();
            fetchContent();
        }

        function loadHome() {
            currentMode = 'home';
            currentPage = 1;
            searchInput.value = '';
            document.getElementById('sectionTitle').innerText = 'Filmes em Destaque';
            document.querySelector('.hero').style.display = 'block';
            setActiveNav('navHome');
            hideCategories();
            fetchContent();
        }

        function loadTrending() {
            currentMode = 'trending';
            currentPage = 1;
            searchInput.value = '';
            document.getElementById('sectionTitle').innerText = 'Em Alta nesta Semana';
            document.querySelector('.hero').style.display = 'none';
            setActiveNav('navTrending');
            hideCategories();
            fetchContent();
        }

        function toggleCategoriesView() {
            currentMode = 'categories';
            currentPage = 1;
            searchInput.value = '';
            document.getElementById('sectionTitle').innerText = 'Explorar por Categoria';
            document.querySelector('.hero').style.display = 'none';
            setActiveNav('navCategories');

            const catBar = document.getElementById('categoriesBar');
            catBar.classList.add('active');

            document.querySelector('.cat-btn').click();
        }

        function hideCategories() {
            document.getElementById('categoriesBar').classList.remove('active');
        }

        function filterByCategory(catId, event) {
            document.querySelectorAll('.cat-btn').forEach(b => b.classList.remove('active'));
            event.target.classList.add('active');

            currentCategory = catId === 'all' ? '' : catId;
            currentMode = 'categories';
            currentPage = 1;

            if(catId === 'all') {
                currentMode = 'home';
                document.getElementById('sectionTitle').innerText = 'Todos os Gêneros (Populares)';
            } else {
                document.getElementById('sectionTitle').innerText = 'Categoria: ' + event.target.innerText;
            }
            fetchContent();
        }

        // --- PAGINAÇÃO ---
        function updatePagination() {
            const container = document.getElementById('paginationContainer');
            const info = document.getElementById('pageInfo');
            const btnPrev = document.getElementById('prevPage');
            const btnNext = document.getElementById('nextPage');

            if (totalPages > 1) {
                container.style.display = 'flex';
                info.innerText = `Página ${currentPage} de ${totalPages > 500 ? 500 : totalPages}`;
                btnPrev.disabled = currentPage === 1;
                btnNext.disabled = currentPage >= (totalPages > 500 ? 500 : totalPages);
            } else {
                container.style.display = 'none';
            }
        }

        function changePage(delta) {
            currentPage += delta;
            fetchContent();
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }

        // --- MODAIS ---
        function closeModal(e) {
            if (e.target.classList.contains('modal-overlay')) {
                e.target.classList.remove('active');
                if (e.target.id === 'detailsModal') {
                    document.getElementById('modalContent').innerHTML = '';
                }
            }
        }

        function forceCloseModal() {
            document.getElementById('detailsModal').classList.remove('active');
            document.getElementById('settingsModal').classList.remove('active');
        }

        function initializeVisualizationStyle() {
            const savedStyle = localStorage.getItem('cinevia_visual_style') || 'classic';
            document.body.classList.toggle('netflix-look', savedStyle === 'netflix');
            const selector = document.getElementById('visualStyleSelect');
            if (selector) selector.value = savedStyle;
        }

        function openSettingsModal() {
            document.getElementById('settingsModal').classList.add('active');
            document.getElementById('apiKeyInput').value = TMDB_API_KEY;
            document.getElementById('apiSecurityCode').value = '';
            const settingsMsg = document.getElementById('settingsMsg');
            settingsMsg.style.display = 'none';
            settingsMsg.textContent = '';
            const styleMsg = document.getElementById('visualStyleMsg');
            styleMsg.style.display = 'none';
            styleMsg.textContent = '';
            document.getElementById('visualStyleSelect').value = localStorage.getItem('cinevia_visual_style') || 'classic';
        }

        function saveSettings() {
            const key = document.getElementById('apiKeyInput').value.trim();
            const code = document.getElementById('apiSecurityCode').value;
            const message = document.getElementById('settingsMsg');
            message.style.display = 'block';

            if (!key) {
                message.style.color = '#ef4444';
                message.textContent = 'Informe uma chave de API válida antes de salvar.';
                return;
            }
            if (code !== API_CHANGE_PASSCODE) {
                message.style.color = '#ef4444';
                message.textContent = 'Código de segurança incorreto. A chave da API não foi alterada.';
                return;
            }

            localStorage.setItem('tmdb_api_key', key);
            TMDB_API_KEY = key;
            message.style.color = '#4ade80';
            message.textContent = 'Chave da API autorizada e salva com sucesso.';
            document.getElementById('apiSecurityCode').value = '';
            setTimeout(() => { forceCloseModal(); initHeroCarousel(); loadHome(); }, 1000);
        }

        function applyVisualizationStyle() {
            const selector = document.getElementById('visualStyleSelect');
            const message = document.getElementById('visualStyleMsg');
            const selectedStyle = selector ? selector.value : 'classic';

            document.body.classList.toggle('netflix-look', selectedStyle === 'netflix');
            localStorage.setItem('cinevia_visual_style', selectedStyle);
            if (currentGridItems.length) renderGrid(currentGridItems);

            message.style.display = 'block';
            message.style.color = '#4ade80';
            message.textContent = selectedStyle === 'netflix'
                ? 'Netflix Look aplicado. O estilo ficará salvo neste navegador.'
                : 'Visual atual restaurado. Sua escolha ficará salva neste navegador.';
        }

        function showError(msg) {
            const grid = document.getElementById('resultsGrid');
            grid.innerHTML = `<div class="message-box" style="color: #ef4444">${msg}</div>`;
        }
