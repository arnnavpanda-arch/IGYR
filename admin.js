const API_BASE = window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost' ? 'http://127.0.0.1:5001/api' : '/api';

async function loadApplication() {
    const pendingContainer = document.getElementById('application-container');
    const approvedContainer = document.getElementById('approved-container');
    const postContainer = document.getElementById('post-payment-container');
    const paymentsListContainer = document.getElementById('payments-list-container');
    const registeredContainer = document.getElementById('registered-container');
    
    if (!pendingContainer || !approvedContainer || !postContainer) return;
    
    try {
        const res = await fetch(`${API_BASE}/admin/institutes`);
        const institutes = await res.json();
        
        pendingContainer.innerHTML = '';
        approvedContainer.innerHTML = '';
        postContainer.innerHTML = '';
        if (registeredContainer) registeredContainer.innerHTML = '';
        if (paymentsListContainer) paymentsListContainer.innerHTML = '';
        
        window.allInstitutesData = institutes; // Store globally for modal

        institutes.forEach(inst => {
            // PENDING REGISTRATIONS
            if (inst.status === 'pending') {
                pendingContainer.innerHTML += `
                    <div class="border rounded p-4 mb-2 bg-yellow-50">
                        <p class="font-bold">${inst.institute.name}</p>
                        <p class="text-sm">${inst.email}</p>
                        <button onclick="updateStatus('${inst.email}', 'approved')" class="bg-green-500 text-white px-3 py-1 rounded text-sm mt-2">Approve</button>
                    </div>`;
            }

            // REGISTERED INSTITUTES TAB & PAYMENTS LIST
            if (inst.status !== 'pending' && inst.status !== 'removed') {
                if (paymentsListContainer) {
                    paymentsListContainer.innerHTML += `
                        <tr class="hover:bg-gray-50 payment-row">
                            <td class="p-3 font-mono text-xs payment-id">${inst.igyr_id || 'IGYR-WAITING'}</td>
                            <td class="p-3 font-bold payment-name">${inst.institute?.name || 'Unknown'}</td>
                            <td class="p-3 uppercase text-[10px] font-bold text-gray-500">${inst.status === 'approved' ? 'Idle / No Order' : inst.status}</td>
                            <td class="p-3 text-right">
                                <button onclick="openPaymentModal('${inst.email}')" class="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-1.5 rounded text-xs font-bold transition-colors">
                                    Manage Ledger
                                </button>
                            </td>
                        </tr>
                    `;
                }
                
                if (registeredContainer) {
                const totalPublished = (inst.history || []).length;
                registeredContainer.innerHTML += `
                    <div class="border rounded-xl p-5 bg-white shadow-sm hover:shadow-md transition-shadow relative group cursor-pointer" onclick="showInstituteDetails('${inst.email}')">
                        <span class="absolute top-3 right-3 text-xs font-bold text-gray-400 bg-gray-100 px-2 py-1 rounded">
                            ${inst.igyr_id || 'IGYR-WAITING'}
                        </span>
                        <div class="w-12 h-12 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mb-3">
                            <i class="fa-solid fa-building-columns text-xl"></i>
                        </div>
                        <h4 class="font-bold text-gray-800 line-clamp-1">${inst.institute?.name || 'Unknown'}</h4>
                        <p class="text-xs text-gray-500 mb-3">${inst.email}</p>
                        
                        <div class="flex justify-between items-center text-xs pt-3 border-t">
                            <span class="font-bold text-gray-600"><i class="fa-solid fa-trophy text-yellow-500 mr-1"></i> ${totalPublished} Results</span>
                            <span class="uppercase tracking-wider font-bold ${inst.status === 'approved' ? 'text-green-500' : 'text-blue-500'}">${inst.status}</span>
                        </div>
                    </div>
                `;
                }
            }
            
            if (inst.status === 'approved' || inst.status === 'order_rejected') {
                approvedContainer.innerHTML += `
                    <div class="border rounded p-4 mb-2 bg-green-50">
                        <p class="font-bold">${inst.institute.name}</p>
                        <p class="text-sm">Status: Idle</p>
                    </div>`;
            }

            // ACTIVE ORDERS & PAYMENTS (SPLIT)
            if (['order_placed', 'documents_required', 'processing', 'verification_pending', 'published'].includes(inst.status)) {
                
                // 1. ORDER ACTIONS HTML (Goes to postContainer)
                let actionsHtml = '';
                if(inst.status === 'order_placed') {
                    actionsHtml = `
                        <div class="flex gap-2">
                            <button onclick="approveFormat('${inst.email}')" class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded text-sm font-bold flex-1">Approve Format & Request Data</button>
                            <button onclick="rejectOrder('${inst.email}')" class="bg-red-100 hover:bg-red-600 hover:text-white text-red-600 px-4 py-2 rounded text-sm font-bold flex-1 border border-red-200 transition-colors">Reject Order</button>
                        </div>
                    `;
                }
                else if(inst.status === 'documents_required') {
                    actionsHtml = `<p class="text-xs text-purple-600 font-bold"><i class="fa-solid fa-clock"></i> Waiting for institute to upload documents...</p>`;
                }
                else if(inst.status === 'processing') {
                    actionsHtml = `
                        <div class="mt-3 border-t pt-3 flex flex-col gap-2">
                            <label class="text-xs font-bold text-gray-700">Upload & Send Tabulation Register:</label>
                            <div class="flex items-center gap-2">
                                <input type="file" id="file-${inst.email}" class="text-xs border p-1 w-full rounded bg-white">
                                <button onclick="sendVerificationWithFile('${inst.email}')" class="bg-orange-600 hover:bg-orange-700 text-white px-4 py-1.5 rounded text-xs font-bold transition-colors whitespace-nowrap"><i class="fa-solid fa-paper-plane mr-1"></i> Send</button>
                            </div>
                        </div>
                    `;
                }
                else if(inst.status === 'verification_pending') {
                    actionsHtml = `<p class="text-xs text-orange-600 font-bold"><i class="fa-solid fa-clock"></i> Waiting for institute to approve tabulation...</p>`;
                }
                
                let adminDocsHtml = (inst.status === 'verification_pending') ? `<div class="mt-2 text-xs p-2 bg-orange-50 rounded border border-orange-200"><span class="font-bold text-orange-700"><i class="fa-solid fa-envelope-circle-check"></i> Tabulation Register Sent to Client via Email</span></div>` : '';
                
                postContainer.innerHTML += `
                    <div class="border rounded-xl p-5 mb-3 bg-white shadow-sm hover:shadow-md transition-shadow">
                        <div class="flex justify-between items-start mb-2">
                            <h4 class="font-bold text-gray-800 text-lg">${inst.institute?.name || 'Unknown'}</h4>
                            <span class="uppercase font-bold text-[10px] bg-gray-100 text-gray-600 px-2 py-1 rounded">${inst.status}</span>
                        </div>
                        
                        <div class="my-3 bg-gray-50 border p-3 rounded-lg text-sm border-l-4 border-l-blue-500">
                            <p class="mb-1"><strong>Output Format:</strong> ${inst.details?.option?.toUpperCase() || 'N/A'}</p>
                            <p class="mb-1"><strong>Students:</strong> ${inst.details?.totalStudents || 0} | <strong>Subjects:</strong> ${inst.details?.totalSubjects || 0}</p>
                            <p><strong>Exam Date:</strong> ${inst.details?.examDate || 'N/A'}</p>
                        </div>
                        
                        ${inst.documents && inst.documents.length ? `<div class="mt-3 text-xs p-2 bg-gray-50 rounded border"><span class="font-bold text-gray-700"><i class="fa-solid fa-folder-open text-yellow-500 mr-1"></i> Client Uploads: </span><br>` + inst.documents.map(d => `<a href="${API_BASE}/files/${d}" target="_blank" class="text-blue-600 underline hover:text-blue-800 ml-1 block mt-1"><i class="fa-solid fa-file-arrow-down"></i> ${d}</a>`).join('') + `</div>` : ''}
                        ${adminDocsHtml}
                        
                        <div class="mt-4">
                            ${actionsHtml}
                        </div>
                    </div>
                `;


            }
        });
    } catch (e) {
        pendingContainer.innerHTML = `Error`;
    }
}

async function updateStatus(email, newStatus) {
    try {
        await fetch(`${API_BASE}/admin/status`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ email, status: newStatus })
        });
        loadApplication();
    } catch(e) { alert('Action failed'); }
}

async function removeInstitute(email) {
    if(confirm("Are you sure you want to remove this institute from the hub?")) {
        try {
            await fetch(`${API_BASE}/admin/remove?email=${email}`, { method: 'DELETE' });
            loadApplication();
        } catch(e) { alert('Action failed'); }
    }
}

async function markTaskDone(email) {
    try {
        await fetch(`${API_BASE}/admin/mark-task-done`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ email })
        });
        alert("Task marked as completed! The client can now submit new results.");
        loadApplication();
    } catch(e) { alert('Action failed'); }
}

document.addEventListener('DOMContentLoaded', loadApplication);

async function approveFormat(email) {
    await fetch(`${API_BASE}/admin/approve-format`, {
        method: 'POST', headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({email})
    });
    loadApplication();
}

async function addPhase(email) {
    const name = document.getElementById(`phase-name-${email}`).value || 'New Phase';
    const amount = parseInt(document.getElementById(`phase-amt-${email}`).value) || 0;
    if (amount <= 0) return alert("Enter valid billed amount");
    
    await fetch(`${API_BASE}/admin/add-phase`, {
        method: 'POST', headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({email, name, amount})
    });
    await loadApplication();
    openPaymentModal(email);
}

async function creditPhase(email) {
    const phase_id = document.getElementById(`sel-phase-${email}`).value;
    const amount = parseInt(document.getElementById(`credit-amt-${email}`).value) || 0;
    if (amount <= 0) return alert("Enter valid paid amount");
    
    await fetch(`${API_BASE}/admin/credit-phase`, {
        method: 'POST', headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({email, phase_id, amount})
    });
    await loadApplication();
    openPaymentModal(email);
}

async function sendVerification(email) {
    await fetch(`${API_BASE}/admin/send-verification`, {
        method: 'POST', headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({email})
    });
    alert('Verification requested');
    loadApplication();
}

async function loadPricing() {
    try {
        const res = await fetch(`${API_BASE}/pricing`);
        const p = await res.json();
        const elNorm = document.getElementById('price-normal');
        if (elNorm) {
            elNorm.value = p.normal;
            document.getElementById('price-excel').value = p.excel;
            document.getElementById('price-both').value = p.both;
            document.getElementById('price-subject').value = p.subject_rate || 0;
            document.getElementById('bank-account').value = p.bank_account || '';
            document.getElementById('bank-ifsc').value = p.ifsc || '';
            document.getElementById('bank-phone').value = p.phone || '';
            if (document.getElementById('config-message')) document.getElementById('config-message').value = p.message || '';
        }
    } catch(e) {}
}

document.addEventListener('DOMContentLoaded', () => {
    loadPricing();
    const pricingForm = document.getElementById('pricing-form');
    if (pricingForm) {
        pricingForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const p = {
                normal: document.getElementById('price-normal').value,
                excel: document.getElementById('price-excel').value,
                both: document.getElementById('price-both').value,
                subject_rate: document.getElementById('price-subject').value,
                bank_account: document.getElementById('bank-account').value,
                ifsc: document.getElementById('bank-ifsc').value,
                phone: document.getElementById('bank-phone').value,
                message: document.getElementById('config-message') ? document.getElementById('config-message').value : ''
            };
            try {
                await fetch(`${API_BASE}/admin/pricing`, {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify(p)
                });
                alert('Rate Card Updated for Clients!');
            } catch(e) { alert('Failed to update'); }
        });
    }
});

async function sendVerificationWithFile(email) {
    const fileInput = document.getElementById(`file-${email}`);
    if (!fileInput.files.length) {
        alert("Please select a file to send for verification!");
        return;
    }
    const formData = new FormData();
    formData.append('email', email);
    formData.append('file', fileInput.files[0]);
    
    try {
        const btn = fileInput.nextElementSibling;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
        const res = await fetch(`${API_BASE}/admin/upload-tabulation`, {
            method: 'POST',
            body: formData
        });
        if (res.ok) {
            alert('Tabulation sent to client for verification!');
            loadApplication();
        } else {
            alert('Failed to send tabulation');
            btn.innerHTML = '<i class="fa-solid fa-paper-plane mr-1"></i> Send';
        }
    } catch(e) { alert('Upload error'); }
}

async function rejectOrder(email) {
    const reason = prompt("Enter reason for rejecting this order (this will be emailed to the client):");
    if (!reason) return;
    
    try {
        await fetch(`${API_BASE}/admin/reject-order`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({email, reason})
        });
        alert('Order rejected and email sent.');
        loadApplication();
    } catch(e) { alert('Action failed'); }
}

function showInstituteDetails(email) {
    const inst = window.allInstitutesData.find(i => i.email === email);
    if(!inst) return;
    
    const profile = inst.institute || {};
    const totalPublished = (inst.history || []).length;
    
    document.getElementById('institute-modal-content').innerHTML = `
        <div class="flex justify-between items-start mb-6">
            <div>
                <h2 class="text-2xl font-black text-gray-800">${profile.name || 'Unknown'}</h2>
                <p class="text-sm text-gray-500 mt-1 font-mono">${inst.igyr_id || 'ID Pending'}</p>
            </div>
            <span class="bg-blue-100 text-blue-800 text-xs font-bold px-3 py-1 rounded-full uppercase">${inst.status}</span>
        </div>
        
        <div class="grid grid-cols-2 gap-4 mb-6">
            <div class="bg-gray-50 p-4 rounded-xl border">
                <span class="text-xs text-gray-500 uppercase font-bold block mb-1">Contact Info</span>
                <p class="text-sm font-medium"><i class="fa-solid fa-envelope mr-2 text-gray-400"></i> ${inst.email}</p>
                <p class="text-sm font-medium mt-1"><i class="fa-solid fa-phone mr-2 text-gray-400"></i> ${profile.mobile || 'N/A'}</p>
            </div>
            <div class="bg-gray-50 p-4 rounded-xl border">
                <span class="text-xs text-gray-500 uppercase font-bold block mb-1">Location</span>
                <p class="text-sm font-medium"><i class="fa-solid fa-location-dot mr-2 text-gray-400"></i> ${profile.district || 'N/A'}, ${profile.state || 'N/A'}</p>
                <p class="text-sm font-medium mt-1"><i class="fa-solid fa-building mr-2 text-gray-400"></i> ${profile.type || 'Institute'}</p>
            </div>
        </div>
        
        <div class="mb-6">
            <h4 class="font-bold text-gray-700 mb-2 border-b pb-1">Activity Overview</h4>
            <div class="flex items-center gap-4 text-sm bg-blue-50 p-3 rounded-lg border border-blue-100">
                <div class="flex-1 text-center">
                    <span class="block text-2xl font-black text-blue-600">${totalPublished}</span>
                    <span class="text-xs text-blue-800 uppercase font-bold">Results Published</span>
                </div>
                <div class="w-px h-10 bg-blue-200"></div>
                <div class="flex-1 text-center">
                    <span class="block text-2xl font-black text-blue-600">${(inst.history || []).reduce((acc, h) => acc + (h.details?.totalStudents || 0), 0)}</span>
                    <span class="text-xs text-blue-800 uppercase font-bold">Total Students Processed</span>
                </div>
            </div>
        </div>
        
        <div class="border-t pt-4 flex justify-end">
            <button onclick="removeInstitute('${inst.email}')" class="bg-red-50 text-red-600 hover:bg-red-600 hover:text-white border border-red-200 px-4 py-2 rounded font-bold text-sm transition-colors">
                <i class="fa-solid fa-trash-can mr-2"></i> Delete / Remove Institute
            </button>
        </div>
    `;
    
    document.getElementById('institute-modal').classList.replace('hidden', 'flex');
}

function filterPaymentsList() {
    const q = document.getElementById('payment-search').value.toLowerCase();
    const rows = document.querySelectorAll('.payment-row');
    rows.forEach(row => {
        const text = row.querySelector('.payment-id').innerText.toLowerCase() + " " + row.querySelector('.payment-name').innerText.toLowerCase();
        row.style.display = text.includes(q) ? '' : 'none';
    });
}

function openPaymentModal(email) {
    const inst = window.allInstitutesData.find(i => i.email === email);
    if(!inst) return;
    
    let phaseOptions = (inst.payments?.phases || []).map(p => `<option value="${p.id}">${p.name} (Due: ₹${p.debited - p.credited})</option>`).join('');
    
    document.getElementById('payment-modal-content').innerHTML = `
        <div class="mb-4 text-center">
            <h4 class="font-black text-gray-800 text-xl">${inst.institute?.name || 'Unknown'}</h4>
            <p class="text-sm font-mono text-gray-500">${inst.igyr_id || 'ID Pending'}</p>
        </div>
        
        <div class="bg-white p-4 rounded-xl border shadow-sm mb-4">
            <strong class="block mb-2 text-gray-700 text-sm border-b pb-2"><i class="fa-solid fa-book-open text-blue-500 mr-1"></i> Current Phase Ledger:</strong>
            <div class="max-h-40 overflow-y-auto pr-2">
                ${(inst.payments?.phases || []).map(p => `
                    <div class="flex flex-col mb-2 bg-gray-50 p-2 rounded border border-gray-200 text-xs">
                        <span class="font-bold text-gray-800 mb-1 border-b pb-1">${p.name}</span>
                        <div class="flex justify-between mt-1">
                            <span class="text-red-600 font-bold">Billed: ₹${p.debited}</span>
                            <span class="text-green-600 font-bold">Paid: ₹${p.credited}</span>
                        </div>
                    </div>
                `).join('')}
                ${!(inst.payments?.phases || []).length ? '<span class="italic text-gray-500 block text-center py-2 text-sm">No billing phases created yet.</span>' : ''}
            </div>
        </div>
        
        <div class="border border-gray-200 bg-white rounded-xl p-4">
            <p class="text-xs font-bold mb-2 text-red-700"><i class="fa-solid fa-file-invoice"></i> 1. Create New Bill Phase</p>
            <div class="flex gap-2 mb-3">
                <input type="text" id="phase-name-${inst.email}" placeholder="Phase Name" class="border p-2 text-sm flex-1 rounded bg-gray-50">
                <input type="number" id="phase-amt-${inst.email}" placeholder="Billed Amt" class="border p-2 text-sm w-24 rounded bg-gray-50">
                <button onclick="addPhase('${inst.email}')" class="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded text-sm font-bold shadow-sm transition-colors">Create</button>
            </div>
            
            ${phaseOptions ? `
            <div class="border-t pt-3 mt-1 border-gray-200">
                <p class="text-xs font-bold mb-2 text-green-700"><i class="fa-solid fa-money-bill-wave"></i> 2. Log Payment for a Phase</p>
                <div class="flex gap-2">
                    <select id="sel-phase-${inst.email}" class="border p-2 text-sm flex-1 rounded bg-gray-50">${phaseOptions}</select>
                    <input type="number" id="credit-amt-${inst.email}" placeholder="Paid Amt" class="border p-2 text-sm w-24 rounded bg-gray-50">
                    <button onclick="creditPhase('${inst.email}')" class="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded text-sm font-bold shadow-sm transition-colors">Credit</button>
                </div>
            </div>
            ` : ''}
        </div>
        
        ${inst.status === 'published' ? `
        <div class="mt-4 border-t pt-4 text-center">
            <p class="text-xs text-gray-500 mb-2">Once all payments are collected and cleared, click below to close the order.</p>
            <button onclick="clearOrder('${inst.email}')" class="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg text-sm font-bold shadow-md transition-colors w-full"><i class="fa-solid fa-box-archive mr-2"></i> Mark Payments Cleared & Archive Order</button>
        </div>
        ` : ''}
    `;
    
    document.getElementById('payment-modal').classList.replace('hidden', 'flex');
}

async function clearOrder(email) {
    if(!confirm("Are you sure? This will archive the order and reset the client's dashboard.")) return;
    try {
        await fetch(`${API_BASE}/admin/mark-task-done`, {
            method: 'POST', headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({email})
        });
        alert('Order archived and cleared successfully!');
        document.getElementById('payment-modal').classList.replace('flex', 'hidden');
        loadApplication();
    } catch(e) { alert('Failed'); }
}
