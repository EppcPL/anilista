// Episodes Counter - Dodaje kafelek z liczbą wszystkich obejrzanych odcinków
// Ten plik jest bezpieczny i nie modyfikuje oryginalnego kodu

(function() {
    'use strict';
    
    let episodesCard = null;
    let isInitialized = false;
    
    // Czekaj na załadowanie strony
    function waitForElement(selector, callback) {
        if (document.querySelector(selector)) {
            callback();
        } else {
            setTimeout(() => waitForElement(selector, callback), 100);
        }
    }
    
    // Funkcja dodająca kafelek z odcinkami
    function addEpisodesCounter() {
        // Sprawdź czy kafelek już istnieje
        if (document.getElementById('episodes-counter-card')) {
            return;
        }
        
        // Znajdź kontener ze statystykami
        const statsContainer = document.getElementById('profile-stats');
        if (!statsContainer) {
            console.log('Episodes Counter: Nie znaleziono kontenera ze statystykami');
            return;
        }
        
        // Znajdź kafelek "Ocena ogólna" (pierwszy kafelek)
        const averageRatingCard = statsContainer.querySelector('.stat-card');
        if (!averageRatingCard) {
            console.log('Episodes Counter: Nie znaleziono kafelka z oceną ogólną');
            return;
        }
        
        // Stwórz nowy kafelek
        episodesCard = document.createElement('div');
        episodesCard.className = 'stat-card';
        episodesCard.id = 'episodes-counter-card';
        episodesCard.innerHTML = `
            <div class="stat-label"><i class="fas fa-list-ol"></i> Wszystkie odcinki</div>
            <div class="stat-value" id="total-watched-episodes">0</div>
        `;
        
        // Wstaw kafelek po kafelku "Ocena ogólna"
        averageRatingCard.parentNode.insertBefore(episodesCard, averageRatingCard.nextSibling);
        
        console.log('Episodes Counter: Dodano kafelek z liczbą odcinków');
        
        // Zaktualizuj wartość
        updateEpisodesCount();
    }
    
    // Funkcja aktualizująca liczbę odcinków
    function updateEpisodesCount() {
        const episodesElement = document.getElementById('total-watched-episodes');
        if (!episodesElement) {
            return;
        }
        
        try {
            // Pobierz listę anime z localStorage
            const animeListData = localStorage.getItem('animeList');
            const plannerListData = localStorage.getItem('plannerList');
            
            console.log('Episodes Counter: Pobrane dane z localStorage:');
            console.log('animeList:', animeListData ? 'istnieje' : 'brak');
            console.log('plannerList:', plannerListData ? 'istnieje' : 'brak');
            
            let totalWatchedEpisodes = 0;
            
            // Przetwórz animeList
            if (animeListData) {
                const animeList = JSON.parse(animeListData);
                console.log('Episodes Counter: Parsed animeList:', animeList.length, 'anime');
                
                if (Array.isArray(animeList)) {
                    animeList.forEach((anime, index) => {
                        const watched = anime.status === 'completed' ? 
                            parseInt(anime.totalEpisodes) || 0 : 
                            parseInt(anime.watchedEpisodes) || 0;
                        
                        totalWatchedEpisodes += watched;
                        
                        console.log(`Episodes Counter: Anime ${index + 1}:`, {
                            title: anime.title,
                            status: anime.status,
                            watchedEpisodes: anime.watchedEpisodes,
                            totalEpisodes: anime.totalEpisodes,
                            counted: watched
                        });
                    });
                }
            }
            
            // Przetwórz plannerList
            if (plannerListData) {
                const plannerList = JSON.parse(plannerListData);
                console.log('Episodes Counter: Parsed plannerList:', plannerList.length, 'anime');
                
                if (Array.isArray(plannerList)) {
                    plannerList.forEach((anime, index) => {
                        const watched = anime.status === 'completed' ? 
                            parseInt(anime.totalEpisodes) || 0 : 
                            parseInt(anime.watchedEpisodes) || 0;
                        
                        totalWatchedEpisodes += watched;
                        
                        console.log(`Episodes Counter: Planner ${index + 1}:`, {
                            title: anime.title,
                            status: anime.status,
                            watchedEpisodes: anime.watchedEpisodes,
                            totalEpisodes: anime.totalEpisodes,
                            counted: watched
                        });
                    });
                }
            }
            
            episodesElement.textContent = totalWatchedEpisodes;
            console.log('Episodes Counter: FINALNA liczba odcinków:', totalWatchedEpisodes);
            
        } catch (error) {
            console.error('Episodes Counter: Błąd podczas aktualizacji:', error);
            episodesElement.textContent = '0';
        }
    }
    
    // Funkcja nasłuchująca na zmiany w anime
    function setupEpisodesListener() {
        // Nasłuchuj na zmiany w localStorage
        window.addEventListener('storage', function(e) {
            if (e.key === 'animeList' || e.key === 'plannerList') {
                console.log('Episodes Counter: Wykryto zmianę w localStorage:', e.key);
                setTimeout(updateEpisodesCount, 100);
            }
        });
        
        // Nasłuchuj na wszystkie zmiany w DOM
        const observer = new MutationObserver(function(mutations) {
            let shouldUpdate = false;
            
            mutations.forEach(function(mutation) {
                // Sprawdź czy zmieniły się statystyki
                if (mutation.type === 'childList' && mutation.target.id === 'profile-stats') {
                    shouldUpdate = true;
                }
                
                // Sprawdź czy zmieniły się wartości w statystykach
                if (mutation.type === 'characterData' || mutation.type === 'attributes') {
                    const target = mutation.target;
                    if (target.nodeType === Node.TEXT_NODE && target.parentElement && 
                        target.parentElement.closest('#profile-stats')) {
                        shouldUpdate = true;
                    }
                }
            });
            
            if (shouldUpdate) {
                console.log('Episodes Counter: Wykryto zmianę w DOM');
                setTimeout(updateEpisodesCount, 100);
            }
        });
        
        // Obserwuj całą stronę
        observer.observe(document.body, { 
            childList: true, 
            subtree: true, 
            characterData: true,
            attributes: true 
        });
        
        // Nasłuchuj na wszystkie kliknięcia
        document.addEventListener('click', function(e) {
            // Sprawdź czy kliknięto na przycisk dodawania/usuwania odcinków
            if (e.target && (
                e.target.classList.contains('btn') || 
                e.target.closest('.btn') ||
                e.target.classList.contains('fa-plus') ||
                e.target.classList.contains('fa-minus') ||
                e.target.closest('.fa-plus') ||
                e.target.closest('.fa-minus')
            )) {
                console.log('Episodes Counter: Wykryto kliknięcie przycisku');
                setTimeout(updateEpisodesCount, 300);
            }
        });
        
        // Nasłuchuj na submit formularzy
        document.addEventListener('submit', function(e) {
            if (e.target && e.target.id && (
                e.target.id === 'episode-form' || 
                e.target.id === 'edit-anime-form' ||
                e.target.id === 'add-anime-form'
            )) {
                console.log('Episodes Counter: Wykryto submit formularza:', e.target.id);
                setTimeout(updateEpisodesCount, 500);
            }
        });
        
        // Nasłuchuj na custom eventy
        window.addEventListener('animeListUpdated', updateEpisodesCount);
        window.addEventListener('episodeUpdated', updateEpisodesCount);
        window.addEventListener('animeAdded', updateEpisodesCount);
        window.addEventListener('animeRemoved', updateEpisodesCount);
        window.addEventListener('profileStatsUpdated', updateEpisodesCount);
    }
    
    // Funkcja inicjalizująca
    function init() {
        if (isInitialized) return;
        
        console.log('Episodes Counter: Inicjalizacja...');
        
        // Czekaj na załadowanie kontenera ze statystykami
        waitForElement('#profile-stats', function() {
            // Dodaj kafelek
            addEpisodesCounter();
            
            // Ustaw nasłuchiwanie
            setupEpisodesListener();
            
            // Aktualizuj co sekundę (backup)
            setInterval(updateEpisodesCount, 1000);
            
            isInitialized = true;
            console.log('Episodes Counter: Inicjalizacja zakończona');
        });
    }
    
    // Czekaj na załadowanie strony
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        // Strona już załadowana, poczekaj chwilę i zainicjalizuj
        setTimeout(init, 500);
    }
    
    // Eksportuj funkcje (opcjonalnie)
    window.EpisodesCounter = {
        update: updateEpisodesCount,
        addCard: addEpisodesCounter,
        init: init
    };
    
})();
