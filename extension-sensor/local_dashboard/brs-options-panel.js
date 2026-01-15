import { STORAGE_KEYS, DEFAULT_SETTINGS } from '../config.js';

document.addEventListener('DOMContentLoaded', () => {
    // 탭 메뉴 관련
    const menuItems = document.querySelectorAll('.menu-item');
    const tabContents = document.querySelectorAll('.tab-content');

    // 화이트리스트 관련
    const whitelistArea = document.getElementById('whitelistArea');
    const btnEdit = document.getElementById('btnEdit');
    const editActions = document.getElementById('editActions');
    const btnCancel = document.getElementById('btnCancel');
    const btnSave = document.getElementById('btnSave');

    // 알림 설정 체크박스
    const notifyLow = document.getElementById('notifyLow');
    const notifyMedium = document.getElementById('notifyMedium');
    const notifyHigh = document.getElementById('notifyHigh');

    // 데이터 관리 버튼
    const clearLogsBtn = document.getElementById('clearLogsBtn');
    const resetSettingsBtn = document.getElementById('resetSettingsBtn');

    // 취소 기능을 위한 원본 데이터 임시 저장 변수
    let originalWhitelistText = "";


    // 탭 전환 로직
    menuItems.forEach(item => {
        item.addEventListener('click', () => {
            menuItems.forEach(i => i.classList.remove('active'));
            tabContents.forEach(c => c.classList.remove('active'));

            item.classList.add('active');
            
            const targetId = item.getAttribute('data-target');
            document.getElementById(targetId).classList.add('active');
        });
    });

    // 화이트리스트 저장 로직
    const handleSave = () => {
        // 중복 클릭 방지 리스너 제거
        btnSave.removeEventListener('click', handleSave);
        btnSave.disabled = true;

        const rawText = whitelistArea.value;
        const lines = rawText.split('\n');

        const cleanList = lines.map(line => {
            let clean = line.trim().toLowerCase();
            if (!clean) return null;

            const isWildcard = clean.startsWith('*.');
            let domainToClean = isWildcard ? clean.slice(2) : clean;

            try {
                if (!domainToClean.startsWith('http')) domainToClean = 'http://' + domainToClean;
                let hostname = new URL(domainToClean).hostname;
                hostname = hostname.replace(/^www\./, '');
                return isWildcard ? '*.' + hostname : hostname;
            } catch (e) {
                let fallback = (isWildcard ? clean.slice(2) : clean)
                    .replace(/^https?:\/\//, '').split('/')[0].replace(/^www\./, '');
                return isWildcard ? '*.' + fallback : fallback;
            }
        }).filter(item => item !== null);

        const uniqueList = [...new Set(cleanList)];

        // 백그라운드 위임
        chrome.runtime.sendMessage({
            action: "UPDATE_WHITELIST",
            data: uniqueList
        }, (response) => {
            if (chrome.runtime.lastError) {
                console.error("[BRS] Message Error:", chrome.runtime.lastError.message);
                
                btnSave.addEventListener('click', handleSave); 
                btnSave.disabled = false;
                
                alert("통신 오류가 발생했습니다. 새로고침 해주세요.");
                return;
            }

            // 작업 완료 후 리스너 다시 등록
            btnSave.addEventListener('click', handleSave);
            btnSave.disabled = false;

            if (response?.status === "success") {
                originalWhitelistText = uniqueList.join('\n');
                whitelistArea.value = originalWhitelistText;
                whitelistArea.disabled = true;
                editActions.style.display = 'none';
                btnEdit.style.display = 'inline-block';
            } else {
                alert('저장 실패: 백그라운드 응답이 없습니다.');
            }
        });
    };

    // 로그 삭제
    const handleClearLogs = () => {
        if (!confirm("정말로 모든 위협 탐지 기록을 삭제하시겠습니까?")) return;

        // 리스너 제거 및 버튼 잠금
        clearLogsBtn.removeEventListener('click', handleClearLogs);
        clearLogsBtn.disabled = true;

        chrome.storage.local.set({ [STORAGE_KEYS.LOGS]: [] }, () => {
            // 작업 완료 후 리스너 복구
            clearLogsBtn.addEventListener('click', handleClearLogs);
            clearLogsBtn.disabled = false;

            if (chrome.runtime.lastError) {
                console.error("[BRS] Failed to clear logs:", chrome.runtime.lastError.message);
            } else {
                alert("로그가 삭제되었습니다.");
            }
        });
    };

    // 설정 초기화
    const handleResetSettings = () => {
        if (!confirm("화이트리스트와 알림 설정을 초기화하시겠습니까?")) return;

        resetSettingsBtn.removeEventListener('click', handleResetSettings);
        resetSettingsBtn.disabled = true;

        chrome.storage.local.set(DEFAULT_SETTINGS, () => {
            resetSettingsBtn.addEventListener('click', handleResetSettings);
            resetSettingsBtn.disabled = false;

            if (chrome.runtime.lastError) {
                console.error("[BRS] Failed to reset settings:", chrome.runtime.lastError.message);
            } else {
                alert("초기화가 완료되었습니다.");
                loadSettings(); 
            }
        });
    };

    loadSettings();

    // 셋팅값 로드
    function loadSettings() {
        chrome.storage.local.get(DEFAULT_SETTINGS, (result) => {

            if (chrome.runtime.lastError) {
                console.error("[BRS] Failed to load settings:", chrome.runtime.lastError);
                return;
            }
            // 화이트 리스트
            const list = result[STORAGE_KEYS.WHITELIST] || [];
            originalWhitelistText = list.join('\n'); 
            whitelistArea.value = originalWhitelistText;

            // 체크박스
            const notiSettings = result[STORAGE_KEYS.NOTIFICATIONS];
            notifyLow.checked = !!notiSettings?.low;
            notifyMedium.checked = !!notiSettings?.medium;
            notifyHigh.checked = !!notiSettings?.high;
        });
    }


    // 화이트리스트 로직
    btnEdit.addEventListener('click', () => {
        whitelistArea.disabled = false;
        whitelistArea.scrollIntoView({ behavior: 'smooth', block: 'center' });
        whitelistArea.focus();
        
        btnEdit.style.display = 'none';
        editActions.style.display = 'flex'; 
    });

    btnCancel.addEventListener('click', () => {
        whitelistArea.value = originalWhitelistText;
        whitelistArea.disabled = true;
        
        editActions.style.display = 'none';
        btnEdit.style.display = 'inline-block';
    });

    btnSave.addEventListener('click', handleSave);


    // 알림 설정
    function saveNotifications() {
        const settings = {
            low: notifyLow.checked,
            medium: notifyMedium.checked,
            high: notifyHigh.checked
        };
        chrome.storage.local.set({ [STORAGE_KEYS.NOTIFICATIONS]: settings });
    }

    [notifyLow, notifyMedium, notifyHigh].forEach(el => {
        el.addEventListener('change', saveNotifications);
    });


    // 데이터 관리
    // 로그 삭제
    clearLogsBtn.addEventListener('click', handleClearLogs);

    // 설정 초기화
    resetSettingsBtn.addEventListener('click', handleResetSettings);

});