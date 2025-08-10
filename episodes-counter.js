// Episodes Counter - Dodaje kafelek z liczbą wszystkich obejrzanych odcinków
// Ten plik jest bezpieczny i nie modyfikuje oryginalnego kodu

(function() {
    'use strict';
    
    let episodesCard = null;
    let isInitialized = false;
    let modal = null;
    
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
        episodesCard.style.cursor = 'pointer';
        episodesCard.innerHTML = `
            <div class="stat-label"><i class="fas fa-list-ol"></i> Wszystkie odcinki</div>
            <div class="stat-value" id="total-watched-episodes">0</div>
        `;
        
        // Dodaj hover effect
        episodesCard.addEventListener('mouseenter', function() {
            this.style.transform = 'scale(1.02)';
            this.style.transition = 'transform 0.2s ease';
        });
        
        episodesCard.addEventListener('mouseleave', function() {
            this.style.transform = 'scale(1)';
        });
        
        // Dodaj click event
        episodesCard.addEventListener('click', showDetailedStats);
        
        // Wstaw kafelek po kafelku "Ocena ogólna"
        averageRatingCard.parentNode.insertBefore(episodesCard, averageRatingCard.nextSibling);
        
        console.log('Episodes Counter: Dodano kafelek z liczbą odcinków');
        
        // Zaktualizuj wartość
        updateEpisodesCount();
    }
    
    // Funkcja pokazująca szczegółowe statystyki
    function showDetailedStats() {
        if (modal) {
            modal.remove();
        }
        
        // Pobierz dane
        const stats = calculateDetailedStats();
        
        // Stwórz modal
        modal = document.createElement('div');
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.8);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 10000;
            font-family: Arial, sans-serif;
        `;
        
        modal.innerHTML = `
            <div style="
                background: white;
                border-radius: 15px;
                padding: 30px;
                max-width: 500px;
                width: 90%;
                max-height: 80vh;
                overflow-y: auto;
                box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
            ">
                <div style="
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 25px;
                    border-bottom: 2px solid #f0f0f0;
                    padding-bottom: 15px;
                ">
                    <h2 style="margin: 0; color: #333; font-size: 24px;">
                        <i class="fas fa-chart-line" style="color: #007bff; margin-right: 10px;"></i>
                        Statystyki Oglądania
                    </h2>
                    <button onclick="this.closest('.episodes-modal').remove()" style="
                        background: none;
                        border: none;
                        font-size: 24px;
                        cursor: pointer;
                        color: #999;
                        padding: 5px;
                    ">&times;</button>
                </div>
                
                <div style="margin-bottom: 25px;">
                    <div style="
                        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                        color: white;
                        padding: 20px;
                        border-radius: 10px;
                        text-align: center;
                        margin-bottom: 20px;
                    ">
                        <div style="font-size: 36px; font-weight: bold; margin-bottom: 5px;">
                            ${stats.totalEpisodes}
                        </div>
                        <div style="font-size: 16px; opacity: 0.9;">
                            Wszystkich obejrzanych odcinków
                        </div>
                    </div>
                </div>
                
                <div style="
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 20px;
                    margin-bottom: 25px;
                ">
                    <div style="
                        background: #f8f9fa;
                        padding: 20px;
                        border-radius: 10px;
                        text-align: center;
                        border-left: 4px solid #28a745;
                    ">
                        <div style="font-size: 24px; font-weight: bold; color: #28a745; margin-bottom: 5px;">
                            ${stats.activeDays}
                        </div>
                        <div style="font-size: 14px; color: #666;">
                            Aktywnych dni
                        </div>
                    </div>
                    
                    <div style="
                        background: #f8f9fa;
                        padding: 20px;
                        border-radius: 10px;
                        text-align: center;
                        border-left: 4px solid #007bff;
                    ">
                        <div style="font-size: 24px; font-weight: bold; color: #007bff; margin-bottom: 5px;">
                            ${stats.averagePerDay}
                        </div>
                        <div style="font-size: 14px; color: #666;">
                            Średnio/dzień
                        </div>
                    </div>
                </div>
                
                <div style="
                    background: #fff3cd;
                    border: 1px solid #ffeaa7;
                    border-radius: 10px;
                    padding: 20px;
                    margin-bottom: 25px;
                    text-align: center;
                ">
                    <div style="font-size: 18px; font-weight: bold; color: #856404; margin-bottom: 10px;">
                        <i class="fas fa-trophy" style="margin-right: 8px;"></i>
                        Najbardziej aktywny dzień
                    </div>
                    <div style="font-size: 24px; font-weight: bold; color: #856404;">
                        ${stats.mostActiveDay.date}
                    </div>
                    <div style="font-size: 16px; color: #856404;">
                        ${stats.mostActiveDay.episodes} odcinków
                    </div>
                </div>
                
                <div>
                    <h3 style="
                        margin: 0 0 15px 0;
                        color: #333;
                        font-size: 18px;
                        text-align: center;
                        border-bottom: 1px solid #eee;
                        padding-bottom: 10px;
                    ">
                        <i class="fas fa-medal" style="color: #ffc107; margin-right: 8px;"></i>
                        3 Najbardziej aktywne dni
                    </h3>
                    <div style="display: flex; flex-direction: column; gap: 10px;">
                        ${stats.top3Days.map((day, index) => `
                            <div style="
                                display: flex;
                                justify-content: space-between;
                                align-items: center;
                                background: ${index === 0 ? '#fff3cd' : '#f8f9fa'};
                                padding: 15px;
                                border-radius: 8px;
                                border-left: 4px solid ${index === 0 ? '#ffc107' : index === 1 ? '#c0c0c0' : '#cd7f32'};
                            ">
                                <div style="display: flex; align-items: center;">
                                    <span style="
                                        background: ${index === 0 ? '#ffc107' : index === 1 ? '#c0c0c0' : '#cd7f32'};
                                        color: white;
                                        width: 24px;
                                        height: 24px;
                                        border-radius: 50%;
                                        display: flex;
                                        align-items: center;
                                        justify-content: center;
                                        font-size: 12px;
                                        font-weight: bold;
                                        margin-right: 12px;
                                    ">${index + 1}</span>
                                    <span style="font-weight: bold; color: #333;">${day.date}</span>
                                </div>
                                <span style="
                                    background: ${index === 0 ? '#ffc107' : index === 1 ? '#c0c0c0' : '#cd7f32'};
                                    color: white;
                                    padding: 4px 12px;
                                    border-radius: 15px;
                                    font-size: 14px;
                                    font-weight: bold;
                                ">${day.episodes} odc.</span>
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>
        `;
        
        // Dodaj klasę do modal
        modal.querySelector('div').classList.add('episodes-modal');
        
        // Dodaj do body
        document.body.appendChild(modal);
        
        // Zamknij po kliknięciu poza modal
        modal.addEventListener('click', function(e) {
            if (e.target === modal) {
                modal.remove();
            }
        });
    }
    
    // Funkcja obliczająca szczegółowe statystyki
    function calculateDetailedStats() {
        try {
            const animeListData = localStorage.getItem('animeList');
            const plannerListData = localStorage.getItem('plannerList');
            
            let totalEpisodes = 0;
            let allActivities = [];
            
            // Przetwórz animeList
            if (animeListData) {
                const animeList = JSON.parse(animeListData);
                if (Array.isArray(animeList)) {
                    animeList.forEach(anime => {
                        if (anime.status === 'completed') {
                            totalEpisodes += parseInt(anime.totalEpisodes) || 0;
                        } else {
                            totalEpisodes += parseInt(anime.watchedEpisodes) || 0;
                        }
                        
                        // Zbierz aktywności
                        if (anime.activities && Array.isArray(anime.activities)) {
                            anime.activities.forEach(activity => {
                                if (activity.date && activity.episodes) {
                                    allActivities.push({
                                        date: activity.date,
                                        episodes: parseInt(activity.episodes) || 0
                                    });
                                }
                            });
                        }
                    });
                }
            }
            
            // Przetwórz plannerList
            if (plannerListData) {
                const plannerList = JSON.parse(plannerListData);
                if (Array.isArray(plannerList)) {
                    plannerList.forEach(anime => {
                        if (anime.status === 'completed') {
                            totalEpisodes += parseInt(anime.totalEpisodes) || 0;
                        } else {
                            totalEpisodes += parseInt(anime.watchedEpisodes) || 0;
                        }
                        
                        // Zbierz aktywności
                        if (anime.activities && Array.isArray(anime.activities)) {
                            anime.activities.forEach(activity => {
                                if (activity.date && activity.episodes) {
                                    allActivities.push({
                                        date: activity.date,
                                        episodes: parseInt(activity.episodes) || 0
                                    });
                                }
                            });
                        }
                    });
                }
            }
            
            // Oblicz statystyki aktywności
            const activityByDate = {};
            allActivities.forEach(activity => {
                if (activityByDate[activity.date]) {
                    activityByDate[activity.date] += activity.episodes;
                } else {
                    activityByDate[activity.date] = activity.episodes;
                }
            });
            
            const activeDays = Object.keys(activityByDate).length;
            const totalActivityEpisodes = Object.values(activityByDate).reduce((sum, episodes) => sum + episodes, 0);
            const averagePerDay = activeDays > 0 ? (totalActivityEpisodes / activeDays).toFixed(1) : '0.0';
            
            // Znajdź najbardziej aktywny dzień
            let mostActiveDay = { date: 'Brak danych', episodes: 0 };
            if (activeDays > 0) {
                const sortedDays = Object.entries(activityByDate)
                    .sort(([,a], [,b]) => b - a);
                mostActiveDay = {
                    date: sortedDays[0][0],
                    episodes: sortedDays[0][1]
                };
            }
            
            // Top 3 dni
            const top3Days = Object.entries(activityByDate)
                .sort(([,a], [,b]) => b - a)
                .slice(0, 3)
                .map(([date, episodes]) => ({ date, episodes }));
            
            return {
                totalEpisodes,
                activeDays,
                averagePerDay,
                mostActiveDay,
                top3Days
            };
            
        } catch (error) {
            console.error('Episodes Counter: Błąd podczas obliczania statystyk:', error);
            return {
                totalEpisodes: 0,
                activeDays: 0,
                averagePerDay: '0.0',
                mostActiveDay: { date: 'Błąd', episodes: 0 },
                top3Days: []
            };
        }
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
            
            let totalWatchedEpisodes = 0;
            
            // Przetwórz animeList
            if (animeListData) {
                const animeList = JSON.parse(animeListData);
                if (Array.isArray(animeList)) {
                    animeList.forEach(anime => {
                        if (anime.status === 'completed') {
                            totalWatchedEpisodes += parseInt(anime.totalEpisodes) || 0;
                        } else {
                            totalWatchedEpisodes += parseInt(anime.watchedEpisodes) || 0;
                        }
                    });
                }
            }
            
            // Przetwórz plannerList
            if (plannerListData) {
                const plannerList = JSON.parse(plannerListData);
                if (Array.isArray(plannerList)) {
                    plannerList.forEach(anime => {
                        if (anime.status === 'completed') {
                            totalWatchedEpisodes += parseInt(anime.totalEpisodes) || 0;
                        } else {
                            totalWatchedEpisodes += parseInt(anime.watchedEpisodes) || 0;
                        }
                    });
                }
            }
            
            episodesElement.textContent = totalWatchedEpisodes;
            
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
        init: init,
        showStats: showDetailedStats
    };
    
})();
