let lastAdminDataHash = '';
const API_BASE = window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost' ? 'http://127.0.0.1:5001/api' : '/api';

async function loadApplication() {
    const pendingContainer = document.getElementById('application-container');
    
    const postContainer = document.getElementById('post-payment-container');
    const paymentsListContainer = document.getElementById('payments-list-container');
    const registeredContainer = document.getElementById('registered-container');
    
    if (!pendingContainer || !postContainer) return;
    
    try {
        const res = await fetch(`${API_BASE}/admin/institutes?t=${Date.now()}`);
        const institutes = await res.json();
        
        // Auto-refresh logic (only re-render if data actually changed)
        const currentHash = JSON.stringify(institutes);
        if (lastAdminDataHash === currentHash) return; // No changes, do not flicker UI
        lastAdminDataHash = currentHash;
        
        let pendingHtml = '';
        let postHtml = '';
        let registeredHtml = '';
        let paymentsListHtml = '';
        const publishContainer = document.getElementById('publish-list');
        if (publishContainer) publishContainer.innerHTML = '';
        let publishInstitutes = [];
        
        window.allInstitutesData = institutes; // Store globally for modal

        institutes.forEach(inst => {
            // PENDING REGISTRATIONS

            if (inst.status === 'ready_to_publish') {
                publishInstitutes.push(inst);
            }

            if (inst.status === 'pending') {
                pendingHtml += `
                    <div class="border rounded p-4 mb-2 bg-yellow-50">
                        <p class="font-bold">${inst.institute?.name || 'Unknown Institute'}</p>
                        <p class="text-sm">${inst.email}</p>
                        <button onclick="updateStatus('${inst.email}', 'approved')" class="bg-green-500 text-white px-3 py-1 rounded text-sm mt-2">Approve</button>
                    </div>`;
            }

            // REGISTERED INSTITUTES TAB & PAYMENTS LIST
            if (inst.status !== 'pending' && inst.status !== 'removed') {
                if (paymentsListContainer) {
                    paymentsListHtml += `
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
                registeredHtml += `
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
                
                
                let badgeClass = 'bg-gray-100 text-gray-600';
                let statusIcon = 'fa-circle-dot';
                let statusText = inst.status.replace('_', ' ').toUpperCase();
                
                if(inst.status === 'order_placed') { badgeClass = 'bg-blue-100 text-blue-700'; statusIcon = 'fa-cart-plus'; statusText = 'FORMAT APPROVAL PENDING'; }
                if(inst.status === 'documents_required') { badgeClass = 'bg-purple-100 text-purple-700'; statusIcon = 'fa-file-arrow-up'; statusText = 'WAITING FOR DATA UPLOAD'; }
                if(inst.status === 'processing') { badgeClass = 'bg-orange-100 text-orange-700'; statusIcon = 'fa-gears'; statusText = 'IN PROCESSING'; }
                if(inst.status === 'verification_pending') { badgeClass = 'bg-yellow-100 text-yellow-700'; statusIcon = 'fa-clipboard-check'; statusText = 'WAITING FOR VERIFICATION'; }
                if(inst.status === 'ready_to_publish') { badgeClass = 'bg-pink-100 text-pink-700'; statusIcon = 'fa-cloud-arrow-up'; statusText = 'READY TO PUBLISH'; }
                if(inst.status === 'published') { badgeClass = 'bg-green-100 text-green-700'; statusIcon = 'fa-check-double'; statusText = 'PUBLISHED'; }

                let adminDocsHtml = (inst.status === 'verification_pending') ? `<div class="mt-3 p-3 bg-yellow-50 rounded-lg border border-yellow-200 text-sm flex items-start gap-2"><i class="fa-solid fa-envelope-circle-check text-yellow-600 mt-0.5"></i><span class="text-yellow-800 font-medium">Tabulation Register Sent to Client via Email. Awaiting their approval.</span></div>` : '';
                
                let docsHtml = '';
                if(inst.documents && inst.documents.length) {
                    docsHtml = `<div class="mt-4"><p class="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2"><i class="fa-solid fa-folder-open text-blue-500 mr-1"></i> Client Uploaded Documents:</p><div class="flex flex-wrap gap-2">` + 
                    inst.documents.map(d => `<a href="${API_BASE}/files/${d}" target="_blank" class="bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1.5 rounded-md text-xs font-medium transition-colors border shadow-sm"><i class="fa-solid fa-file-arrow-down text-blue-600 mr-1"></i> ${d.substring(0,20)}...</a>`).join('') + 
                    `</div></div>`;
                }

                postHtml += `
                    <div class="bg-white rounded-2xl shadow-sm hover:shadow-lg border border-gray-100 overflow-hidden transition-all duration-300 flex flex-col h-full transform hover:-translate-y-1">
                        <!-- Card Header -->
                        <div class="px-6 py-4 border-b border-gray-100 flex justify-between items-start bg-gradient-to-br from-white to-gray-50">
                            <div>
                                <div class="mb-1 flex items-center gap-2 flex-wrap">
                                    <span class="bg-gray-800 text-white text-[10px] px-2 py-0.5 rounded font-mono tracking-wider shadow-sm">${inst.igyr_id || 'IGYR-WAITING'}</span>
                                    <h4 class="font-black text-gray-800 text-lg">${inst.institute?.name || 'Unknown Institute'}</h4>
                                </div>
                                <div class="flex items-center gap-3">
                                    <p class="text-xs text-gray-500 font-mono"><i class="fa-regular fa-envelope mr-1"></i> ${inst.email}</p>
                                    <div onclick="showInstituteDetails('${inst.email}')" class="text-xs text-blue-600 hover:text-blue-800 font-bold hover:underline transition-colors flex items-center gap-1 cursor-pointer z-10 relative">
                                        <i class="fa-solid fa-up-right-from-square"></i> View Profile
                                    </div>
                                </div>
                            </div>
                            <span class="px-3 py-1 rounded-full text-[10px] font-extrabold tracking-wider ${badgeClass} border border-opacity-50 border-current shadow-sm flex items-center gap-1 whitespace-nowrap">
                                <i class="fa-solid ${statusIcon}"></i> ${statusText}
                            </span>
                        </div>
                        
                        <!-- Order Details Grid -->
                        <div class="p-6 flex-grow">
                            <div class="grid grid-cols-2 gap-4 mb-4">
                                <div class="bg-gray-50 p-3 rounded-xl border border-gray-100">
                                    <span class="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Requested Format</span>
                                    <span class="font-bold text-blue-700 text-sm bg-blue-50 px-2 py-0.5 rounded border border-blue-100">${inst.details?.option?.toUpperCase() || 'N/A'}</span>
                                </div>
                                <div class="bg-gray-50 p-3 rounded-xl border border-gray-100">
                                    <span class="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Target Exam Date</span>
                                    <span class="font-bold text-gray-700 text-sm"><i class="fa-regular fa-calendar text-blue-400 mr-1"></i> ${inst.details?.examDate || 'N/A'}</span>
                                </div>
                                <div class="bg-gray-50 p-3 rounded-xl border border-gray-100">
                                    <span class="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Total Students</span>
                                    <span class="font-black text-gray-800 text-lg">${inst.details?.totalStudents || 0}</span>
                                </div>
                                <div class="bg-gray-50 p-3 rounded-xl border border-gray-100">
                                    <span class="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Total Subjects</span>
                                    <span class="font-black text-gray-800 text-lg">${inst.details?.totalSubjects || 0}</span>
                                </div>
                            </div>
                            
                            ${docsHtml}
                            ${adminDocsHtml}
                        </div>
                        
                        <!-- Action Footer -->
                        <div class="px-6 py-4 bg-gray-50 border-t border-gray-100 mt-auto">
                            ${actionsHtml}
                        </div>
                    </div>
                `;



            }

        });
        
        if (typeof morphdom !== 'undefined') {
            const wrap = (html, node) => `<${node.tagName.toLowerCase()} id="${node.id}" class="${node.className}">${html}</${node.tagName.toLowerCase()}>`;
            
            morphdom(pendingContainer, wrap(pendingHtml, pendingContainer));
            morphdom(postContainer, wrap(postHtml, postContainer));
            if (registeredContainer) morphdom(registeredContainer, wrap(registeredHtml, registeredContainer));
            if (paymentsListContainer) morphdom(paymentsListContainer, wrap(paymentsListHtml, paymentsListContainer));
        } else {
            pendingContainer.innerHTML = pendingHtml;
            postContainer.innerHTML = postHtml;
            if (registeredContainer) registeredContainer.innerHTML = registeredHtml;
            if (paymentsListContainer) paymentsListContainer.innerHTML = paymentsListHtml;
        }
        
        if (typeof renderPublishList === 'function') {
            renderPublishList(publishInstitutes);
        }
    } catch (e) {

        console.error(e); pendingContainer.innerHTML = `Error: ` + e.message;
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
    } catch(e) { showToast('Action failed'); }
}

async function removeInstitute(email) {
    if(await confirmAction("Are you sure you want to remove this institute from the hub?")) {
        try {
            await fetch(`${API_BASE}/admin/remove?email=${email}`, { method: 'DELETE' });
            loadApplication();
        } catch(e) { showToast('Action failed'); }
    }
}

async function markTaskDone(email) {
    try {
        await fetch(`${API_BASE}/admin/mark-task-done`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ email })
        });
        showToast("Task marked as completed! The client can now submit new results.");
        loadApplication();
    } catch(e) { showToast('Action failed'); }
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
    if (amount <= 0) return showToast("Enter valid billed amount");
    
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
    if (amount <= 0) return showToast("Enter valid paid amount");
    
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
    showToast('Verification requested');
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
                showToast('Rate Card Updated for Clients!');
            } catch(e) { showToast('Failed to update'); }
        });
    }
});

async function sendVerificationWithFile(email) {
    const fileInput = document.getElementById(`file-${email}`);
    if (!fileInput.files.length) {
        showToast("Please select a file to send for verification!");
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
            showToast('Tabulation sent to client for verification!');
            loadApplication();
        } else {
            showToast('Failed to send tabulation');
            btn.innerHTML = '<i class="fa-solid fa-paper-plane mr-1"></i> Send';
        }
    } catch(e) { showToast('Upload error'); }
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
        showToast('Order rejected and email sent.');
        loadApplication();
    } catch(e) { showToast('Action failed'); }
}

function showInstituteDetails(email) {
    console.log("showInstituteDetails called with:", email);
    const inst = window.allInstitutesData.find(i => i.email === email);
    if(!inst) {
        console.error("Institute not found in window.allInstitutesData:", email);
        return;
    }
    
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
                    <span class="block text-2xl font-black text-blue-600">${(inst.history || []).reduce((acc, h) => acc + parseInt(h.details?.totalStudents || 0), 0)}</span>
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
            <div class="flex flex-col md:flex-row gap-2 mb-3">
                <input type="text" id="phase-name-${inst.email}" placeholder="Phase Name" class="border p-2 text-sm flex-1 rounded bg-gray-50 w-full">
                <div class="flex gap-2 w-full md:w-auto">
                    <input type="number" id="phase-amt-${inst.email}" placeholder="Billed Amt" class="border p-2 text-sm flex-1 md:w-24 rounded bg-gray-50">
                    <button onclick="addPhase('${inst.email}')" class="bg-red-600 hover:bg-red-700 text-white px-4 py-2 md:px-3 md:py-1 rounded text-sm font-bold shadow-sm transition-colors whitespace-nowrap">Create</button>
                </div>
            </div>
            
            ${phaseOptions ? `
            <div class="border-t pt-3 mt-1 border-gray-200">
                <p class="text-xs font-bold mb-2 text-green-700"><i class="fa-solid fa-money-bill-wave"></i> 2. Log Payment for a Phase</p>
                <div class="flex flex-col md:flex-row gap-2">
                    <select id="sel-phase-${inst.email}" class="border p-2 text-sm flex-1 rounded bg-gray-50 w-full">${phaseOptions}</select>
                    <div class="flex gap-2 w-full md:w-auto">
                        <input type="number" id="credit-amt-${inst.email}" placeholder="Paid Amt" class="border p-2 text-sm flex-1 md:w-24 rounded bg-gray-50">
                        <button onclick="creditPhase('${inst.email}')" class="bg-green-600 hover:bg-green-700 text-white px-4 py-2 md:px-3 md:py-1 rounded text-sm font-bold shadow-sm transition-colors whitespace-nowrap">Credit</button>
                    </div>
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
    if(!(await confirmAction("This will archive the order and reset the client's dashboard. Do you want to continue?"))) return;
    try {
        await fetch(`${API_BASE}/admin/mark-task-done`, {
            method: 'POST', headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({email})
        });
        showToast('Order archived and cleared successfully!');
        document.getElementById('payment-modal').classList.replace('flex', 'hidden');
        loadApplication();
    } catch(e) { showToast('Failed'); }
}


function renderPublishList(institutes) {
    const container = document.getElementById('publish-list');
    if (institutes.length === 0) {
        container.innerHTML = '<div class="text-center py-8 text-gray-500"><i class="fa-solid fa-check-circle text-4xl mb-3 text-gray-300"></i><p>No institutes are currently waiting for publication.</p></div>';
        return;
    }
    
    let html = '<div class="grid grid-cols-1 gap-4">';
    institutes.forEach(inst => {
        html += `
            <div class="border rounded-lg p-4 flex flex-col md:flex-row justify-between items-center gap-4 bg-gray-50 hover:bg-pink-50 transition-colors">
                <div>
                    <h4 class="font-bold text-gray-800 text-lg">${inst.name || 'Unknown'}</h4>
                    <p class="text-sm text-gray-600"><i class="fa-solid fa-envelope mr-1"></i> ${inst.email}</p>
                    <p class="text-xs font-semibold text-emerald-600 mt-1"><i class="fa-solid fa-circle-check mr-1"></i> Tabulation Register Approved by Institute</p>
                </div>
                <button onclick="publishResults('${inst.email}')" class="bg-gradient-to-r from-pink-500 to-rose-500 text-white px-6 py-2.5 rounded-lg shadow-md hover:shadow-lg font-bold transition-all transform hover:-translate-y-0.5 whitespace-nowrap">
                    <i class="fa-solid fa-cloud-arrow-up mr-2"></i> Publish Results
                </button>
            </div>
        `;
    });
    html += '</div>';
    container.innerHTML = html;
}

async function publishResults(email) {
    if (!(await confirmAction('Are you sure you want to officially PUBLISH the results for this institute? This will immediately send an email notification to them with their final data.'))) return;
    
    try {
        const res = await fetch(`${API_BASE}/admin/publish`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email })
        });
        const data = await res.json();
        
        if (res.ok) {
            showToast('Results published successfully! Email notification sent.');
            loadApplication();
        } else {
            showToast(data.error || 'Failed to publish results');
        }
    } catch (err) {
        console.error(err);
        showToast('Server connection failed');
    }
}


window.showToast = function(msg) {
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        container.className = 'fixed bottom-5 right-5 space-y-3 z-[9999]';
        document.body.appendChild(container);
    }
    const isError = msg.toLowerCase().includes('fail') || msg.toLowerCase().includes('error') || msg.toLowerCase().includes('reject') || msg.toLowerCase().includes('invalid');
    const type = isError ? 'error' : 'success';
    const toast = document.createElement('div');
    const bg = type === 'error' ? 'bg-red-50 border-red-500 text-red-700' : 'bg-green-50 border-green-500 text-green-700';
    const icon = type === 'error' ? 'fa-circle-xmark' : 'fa-circle-check';
    toast.className = `flex items-center p-4 mb-4 text-sm rounded-lg border-l-4 shadow-xl ${bg} transition-all duration-300 transform translate-y-10 opacity-0 min-w-[300px]`;
    toast.innerHTML = `<i class="fa-solid ${icon} text-xl mr-3"></i><span class="font-bold">${msg}</span>`;
    container.appendChild(toast);
    
    setTimeout(() => {
        toast.classList.remove('translate-y-10', 'opacity-0');
    }, 10);
    
    setTimeout(() => {
        toast.classList.add('translate-y-10', 'opacity-0');
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}


window.confirmAction = function(message) {
    return new Promise((resolve) => {
        const overlay = document.createElement('div');
        overlay.className = 'fixed inset-0 bg-black/60 z-[10000] flex items-center justify-center fade-in backdrop-blur-sm p-4';
        
        const modal = document.createElement('div');
        modal.className = 'bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden transform transition-all';
        
        modal.innerHTML = `
            <div class="p-6">
                <div class="w-16 h-16 bg-blue-50 text-blue-500 rounded-full flex items-center justify-center mx-auto mb-4 text-3xl">
                    <i class="fa-solid fa-circle-question animate-pulse"></i>
                </div>
                <h3 class="text-xl font-bold text-center text-gray-800 mb-2">Are you sure?</h3>
                <p class="text-gray-600 text-center mb-6 leading-relaxed">${message}</p>
                <div class="flex gap-3">
                    <button id="btn-confirm-no" class="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-800 font-bold py-3 px-4 rounded-xl transition-colors">Cancel</button>
                    <button id="btn-confirm-yes" class="flex-1 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold py-3 px-4 rounded-xl shadow-lg transition-transform transform hover:-translate-y-0.5">Yes, Proceed</button>
                </div>
            </div>
        `;
        
        overlay.appendChild(modal);
        document.body.appendChild(overlay);
        
        document.getElementById('btn-confirm-no').onclick = () => {
            overlay.remove();
            resolve(false);
        };
        
        document.getElementById('btn-confirm-yes').onclick = () => {
            overlay.remove();
            resolve(true);
        };
    });
}

// Auto-poll for live real-time updates across multiple devices
setInterval(loadApplication, 3000);
