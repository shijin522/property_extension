// lib/db.js
// A minimal wrapper for IndexedDB to store FileSystemHandles
const DB_NAME = 'PropertyManagerDB';
const STORE_NAME = 'handles';

export const db = {
    async get(key) {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, 1);
            request.onupgradeneeded = (e) => {
                e.target.result.createObjectStore(STORE_NAME);
            };
            request.onsuccess = (e) => {
                const transaction = e.target.result.transaction(STORE_NAME, 'readonly');
                const store = transaction.objectStore(STORE_NAME);
                const req = store.get(key);
                req.onsuccess = () => resolve(req.result);
                req.onerror = () => reject(req.error);
            };
            request.onerror = () => reject(request.error);
        });
    },
    async set(key, value) {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, 1);
            request.onupgradeneeded = (e) => {
                e.target.result.createObjectStore(STORE_NAME);
            };
            request.onsuccess = (e) => {
                const transaction = e.target.result.transaction(STORE_NAME, 'readwrite');
                const store = transaction.objectStore(STORE_NAME);
                const req = store.put(value, key);
                req.onsuccess = () => resolve();
                req.onerror = () => reject(req.error);
            };
            request.onerror = () => reject(request.error);
        });
    }
};
