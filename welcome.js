import { db } from './lib/db.js';

document.getElementById('btnSelect').addEventListener('click', async () => {
    try {
        const handle = await window.showDirectoryPicker();
        await db.set('directoryHandle', handle);

        // Verify we can write
        const testFile = await handle.getFileHandle('test_permission.txt', { create: true });
        const writable = await testFile.createWritable();
        await writable.write('Permission verified');
        await writable.close();
        await handle.removeEntry('test_permission.txt');

        document.getElementById('msgSuccess').style.display = 'block';
        document.getElementById('btnSelect').disabled = true;
        document.getElementById('btnSelect').innerText = "Linked";
    } catch (err) {
        console.error(err);
        alert("Error setting up folder: " + err.message);
    }
});
