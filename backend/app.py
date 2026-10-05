import os
import sys
# Add the current directory to sys.path so Vercel can find the modules
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from database import get_db
from email_service import send_email, send_email_with_attachment
import random
import os
from datetime import datetime

app = Flask(__name__)
CORS(app)  # Enable CORS for frontend requests









@app.errorhandler(500)
def server_error(e):
    return jsonify({"error": "Internal server error"}), 500





# Temporary in-memory store for OTPs (In a real app, use Redis or MongoDB with TTL)
# Format: { "email@test.com": { "otp": "1234", "expires": timestamp } }
otp_store = {}

@app.route('/api/health', methods=['GET'])
def health_check():
    return jsonify({"status": "healthy"})

@app.route('/api/institutes/resend-receipt', methods=['POST'])
def resend_receipt():
    from email_service import send_email
    data = request.json
    email = data.get('email', '').strip().lower()
    txn_id = data.get('txn_id', '')
    
    db = get_db()
    inst = db['institutes'].find_one({"email": email})
    if not inst:
        return jsonify({"error": "Institute not found"}), 404
        
    inst_name = inst.get("institute", {}).get("name", "Institute")
    
    txn = None
    phase_name = "Payment Phase"
    
    if "payments" in inst and "transactions" in inst["payments"]:
        for t in inst["payments"]["transactions"]:
            if t.get("id") == txn_id:
                txn = t
                break
                
    if not txn:
        return jsonify({"error": "Transaction not found"}), 404
        
    if "payments" in inst and "phases" in inst["payments"]:
        for p in inst["payments"]["phases"]:
            if p.get("id") == txn.get("phase_id"):
                phase_name = p.get("name", phase_name)
                break
                
    amount = txn.get("amount", 0)
    
    subject = f"Official Payment Receipt: INR {amount}"
    body = f"""
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden;">
        <div style="background-color: #10b981; padding: 20px; text-align: center; color: white;">
            <h2 style="margin: 0;">Payment Receipt (Copy)</h2>
        </div>
        <div style="padding: 20px;">
            <p>Dear <b>{inst_name}</b>,</p>
            <p>This is a copy of the receipt for your payment.</p>
            <div style="background-color: #f3f4f6; padding: 15px; border-radius: 8px; margin: 20px 0;">
                <p style="margin: 5px 0;"><b>Receipt ID:</b> {txn_id}</p>
                <p style="margin: 5px 0;"><b>Amount Paid:</b> INR {amount}</p>
                <p style="margin: 5px 0;"><b>Towards:</b> {phase_name}</p>
                <p style="margin: 5px 0;"><b>Date:</b> {txn.get('date', '')}</p>
                <p style="margin: 5px 0;"><b>Status:</b> <span style="color: #10b981; font-weight: bold;">SUCCESS</span></p>
            </div>
            <p>If you have any questions, please contact our support team.</p>
            <p>Thank you,<br><b>India Get Your Result (IGYR)</b></p>
        </div>
    </div>
    """
    send_email(email, subject, body)
    
    return jsonify({"message": "Receipt resent"}), 200

@app.route('/api/auth/send-code', methods=['POST'])
def send_code():
    data = request.json
    email = data.get('email', '').strip().lower()
    
    if not email:
        return jsonify({"error": "Email is required"}), 400
        
    otp = str(random.randint(1000, 9999))
    otp_store[email] = otp
    
    body_html = f"""
    <div style="font-family: sans-serif; max-width: 500px; margin: auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
        <h2 style="color: #4F46E5; text-align: center;">Your Verification Code</h2>
        <p>You requested to sign in or register at <strong>India Get Your Result</strong>.</p>
        <div style="background-color: #f3f4f6; padding: 15px; text-align: center; font-size: 24px; font-weight: bold; letter-spacing: 5px; border-radius: 5px; margin: 20px 0;">
            {otp}
        </div>
        <p style="font-size: 12px; color: #666; text-align: center;">If you didn't request this, please ignore this email.</p>
    </div>
    """
    
    success = send_email(email, "India Get Your Result - Login Code", body_html)
    
    if success:
        return jsonify({"message": "Verification code sent to email"}), 200
    else:
        return jsonify({"error": "Failed to send email. Please check the email address."}), 500

@app.route('/api/auth/verify', methods=['POST'])
def verify_code():
    data = request.json
    email = data.get('email', '').strip().lower()
    code = data.get('code', '').strip()
    is_new_user = data.get('isNewUser', False)
    
    db = get_db()
    institutes_col = db['institutes']
    
    # Bypass OTP if it's 1234 just for testing locally if SMTP blocks us (optional, good for dev)
    # But let's enforce real OTP here since that's what the user wants!
    if email in otp_store and otp_store[email] == code:
        del otp_store[email] # Clear OTP after successful use
        
        # Check if they exist in DB
        existing_inst = institutes_col.find_one({"email": email})
        
        if is_new_user:
            if existing_inst:
                return jsonify({"error": "This email is already registered. Please switch to Sign In."}), 400
            return jsonify({"status": "verified", "message": "Code verified, please proceed to setup profile."}), 200
        else:
            if not existing_inst:
                return jsonify({"error": "Not registered or account was removed by admin."}), 404
            
            # Return current status so frontend knows where to route
            return jsonify({
                "status": existing_inst.get('status', 'pending'),
                "message": "Login successful"
            }), 200
    
    return jsonify({"error": "Invalid or expired verification code."}), 400

@app.route('/api/institutes/register', methods=['POST'])
def register_institute():
    data = request.json
    email = data.get('email', '').strip().lower()
    
    db = get_db()
    institutes_col = db['institutes']
    
    import random
    igyr_id = "IGYR-" + str(random.randint(10000000, 99999999))
    
    # Overwrite if exists in rare case, or create new
    institute_doc = {
        "email": email,
        "igyr_id": igyr_id,
        "status": "pending",
        "institute": data.get('instituteData', {}),
        "created_at": datetime.utcnow()
    }
    
    institutes_col.update_one({"email": email}, {"$set": institute_doc}, upsert=True)
    
    # Send confirmation email to user
    send_email(email, "Registration Received - India Get Your Result", 
        "<h3>Registration Received</h3><p>Your institution details have been received and are now under review by the Admin Team.</p>")
    
    return jsonify({"message": "Registration successful, pending admin approval"}), 200

@app.route('/api/institutes/status', methods=['GET'])
def get_status():
    email = request.args.get('email', '').strip().lower()
    
    db = get_db()
    inst = db['institutes'].find_one({"email": email})
    
    if not inst:
        return jsonify({"error": "Not found"}), 404
        
    # Send back necessary data without MongoDB _id object
    return jsonify({
        "status": inst.get("status"),
        "email": inst.get("email"),
        "institute": inst.get("institute", {}),
        "igyr_id": inst.get("igyr_id", ""),
        "details": inst.get("details"),
        "tabulation_file": inst.get("tabulation_file"),
        "history": inst.get("history", []),
        "payments": inst.get("payments", {}),
        "rejection_reason": inst.get("rejection_reason", "")
    }), 200

@app.route('/api/institutes/order', methods=['POST'])
def create_order():
    data = request.json
    email = data.get('email', '').strip().lower()
    details = data.get('resultDetails', {})
    
    db = get_db()
    institutes_col = db['institutes']
    
    # Change status to 'order_placed' (pending admin format approval)
    result = institutes_col.update_one(
        {"email": email},
        {"$set": {
            "status": "order_placed", 
            "details": details,
            "payments": {"total": 0, "paid": 0, "phases": []},
            "documents": []
        }}
    )
    
    if result.matched_count == 0:
        return jsonify({"error": "Account not found"}), 404
        
    return jsonify({"message": "Order placed, pending admin format approval"}), 200

# NEW ROUTES FOR UPLOADS AND PAYMENTS
from werkzeug.utils import secure_filename
import os

UPLOAD_FOLDER = '/tmp/uploads'
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

@app.route('/api/institutes/upload', methods=['POST'])
def upload_document():
    import os
    email = request.form.get('email', '').strip().lower()
    if 'file' not in request.files:
        return jsonify({"error": "No file part"}), 400
    file = request.files['file']
    if file.filename == '':
        return jsonify({"error": "No selected file"}), 400
        
    from werkzeug.utils import secure_filename
    filename = secure_filename(email + "_" + file.filename)
    filepath = os.path.join(UPLOAD_FOLDER, filename)
    
    # 1. Save temporarily to attach to email
    file.save(filepath)
    
    db = get_db()
    inst = db['institutes'].find_one({"email": email})
    inst_name = inst.get('institute', {}).get('name', email) if inst else email
    
    # 2. Update status to processing (DO NOT store the document in DB)
    db['institutes'].update_one(
        {"email": email},
        {
            "$set": {"status": "processing"}
        }
    )
    
    # 3. Send the uploaded data directly to the company inbox!
    from email_service import send_email_with_attachment
    company_email = 'indiagetyourresult@gmail.com'
    subject = f"Secure Data Upload: {inst_name}"
    body = f"<h3>Secure Data Received</h3><p>Institute: <b>{inst_name}</b> ({email})</p><p>Please find the attached data files. This file was NOT stored in the database for security purposes.</p>"
    
    success = send_email_with_attachment(company_email, subject, body, filepath)
    
    # 4. Delete the temporary file from the server so it is completely secure and only in email
    try:
        if os.path.exists(filepath):
            os.remove(filepath)
    except Exception as e:
        print("Could not delete temp file:", e)
    
    if success:
        return jsonify({"message": "File uploaded securely to email!"}), 200
    else:
        # Revert status if email failed
        db['institutes'].update_one({"email": email}, {"$set": {"status": "documents_required"}})
        return jsonify({"error": "Failed to send email. Please try again."}), 500

@app.route('/api/admin/approve-format', methods=['POST'])
def admin_approve_format():
    from datetime import datetime
    data = request.json
    email = data.get('email', '').strip().lower()
    
    db = get_db()
    institutes_col = db['institutes']
    inst = institutes_col.find_one({"email": email})
    
    if not inst:
        return jsonify({"error": "Institute not found"}), 404
        
    # Calculate automated bill
    pricing = db['config'].find_one({"type": "pricing"}) or {"normal": 50, "excel": 100, "both": 150}
    
    details = inst.get("details", {})
    option = details.get("option", "normal")
    try:
        students = int(details.get("totalStudents", 0))
    except ValueError:
        students = 0
        
    try:
        subjects = int(details.get("totalSubjects", 0))
    except ValueError:
        subjects = 0
        
    price_per = pricing.get(option, 50)
    subject_rate = float(pricing.get("subject_rate", 0))
    
    # Calculate base student cost + subject add-on cost
    total_bill = (students * price_per) + (subjects * subject_rate)
    
    phase = {
        "id": "phase_" + str(int(datetime.utcnow().timestamp())),
        "name": "Phase 1: Initial Billing (Format Approved)",
        "debited": total_bill,
        "credited": 0,
        "date": datetime.utcnow().isoformat()
    }
    
    # Change status to documents_required AND inject automated bill
    institutes_col.update_one(
        {"email": email},
        {
            "$set": {"status": "documents_required"},
            "$push": {"payments.phases": phase}
        }
    )
    
    body = f"<p>Great news! Your requested format has been approved.</p>"
    body += f"<p>Based on your order of {students} students ({option.upper()} format), an initial bill of <b>Rs. {total_bill}</b> has been generated on your dashboard.</p>"
    body += f"<p>Please log in to your dashboard to view payment details and upload your student data files securely.</p>"
    
    send_email(email, "Format Approved - Action Required", body)
    
    return jsonify({"message": "Format approved and initial bill generated successfully"}), 200

@app.route('/api/admin/add-phase', methods=['POST'])
def admin_add_phase():
    from datetime import datetime
    data = request.json
    email = data.get('email', '').strip().lower()
    name = data.get('name', 'New Phase')
    amount = data.get('amount', 0)
    
    db = get_db()
    phase = {
        "id": "phase_" + str(int(datetime.utcnow().timestamp())),
        "name": name,
        "debited": amount,
        "credited": 0,
        "date": datetime.utcnow().isoformat()
    }
    
    db['institutes'].update_one(
        {"email": email},
        {"$push": {"payments.phases": phase}}
    )
    
    return jsonify({"message": "Phase created"}), 200

@app.route('/api/admin/credit-phase', methods=['POST'])
def admin_credit_phase():
    from email_service import send_email
    data = request.json
    email = data.get('email', '').strip().lower()
    phase_id = data.get('phase_id', '')
    amount = data.get('amount', 0)
    
    db = get_db()
    
    from datetime import datetime
    txn = {
        "id": "txn_" + str(int(datetime.utcnow().timestamp())),
        "phase_id": phase_id,
        "amount": amount,
        "date": datetime.utcnow().isoformat()
    }

    db['institutes'].update_one(
        {"email": email, "payments.phases.id": phase_id},
        {
            "$inc": {"payments.phases.$.credited": amount},
            "$push": {"payments.transactions": txn}
        }
    )
    
    inst = db['institutes'].find_one({"email": email})
    phase_name = "Payment Phase"
    inst_name = "Institute"
    if inst:
        inst_name = inst.get("institute", {}).get("name", "Institute")
        if "payments" in inst:
            for p in inst["payments"].get("phases", []):
                if p["id"] == phase_id:
                    phase_name = p.get("name", phase_name)
                    break
    
    if amount > 0:
        subject = f"Official Payment Receipt: INR {amount}"
        body = f"""
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden;">
            <div style="background-color: #10b981; padding: 20px; text-align: center; color: white;">
                <h2 style="margin: 0;">Payment Receipt</h2>
            </div>
            <div style="padding: 20px;">
                <p>Dear <b>{inst_name}</b>,</p>
                <p>We acknowledge with thanks the receipt of your payment.</p>
                <div style="background-color: #f3f4f6; padding: 15px; border-radius: 8px; margin: 20px 0;">
                    <p style="margin: 5px 0;"><b>Amount Paid:</b> INR {amount}</p>
                    <p style="margin: 5px 0;"><b>Towards:</b> {phase_name}</p>
                    <p style="margin: 5px 0;"><b>Status:</b> <span style="color: #10b981; font-weight: bold;">SUCCESS</span></p>
                </div>
                <p>If you have any questions, please contact our support team.</p>
                <p>Thank you,<br><b>India Get Your Result (IGYR)</b></p>
            </div>
        </div>
        """
        send_email(email, subject, body)
    
    return jsonify({"message": "Credit added and receipt emailed"}), 200

@app.route('/api/admin/send-verification', methods=['POST'])
def admin_send_verification():
    data = request.json
    email = data.get('email', '').strip().lower()
    
    db = get_db()
    db['institutes'].update_one({"email": email}, {"$set": {"status": "verification_pending"}})
    
    send_email(email, "Verify Your Tabulation Register", "<p>Please log in to your dashboard to verify the draft tabulation register before we publish the results tomorrow.</p>")
    return jsonify({"message": "Verification request sent"}), 200

@app.route('/api/institutes/verify-response', methods=['POST'])
def client_verify_response():
    data = request.json
    email = data.get('email', '').strip().lower()
    response = data.get('response') # 'approve' or 'reject'
    reason = data.get('reason', '')
    
    db = get_db()
    if response == 'reject':
        db['institutes'].update_one({"email": email}, {"$set": {"status": "processing", "rejection_reason": reason}})
        # Could email admin here
    else:
        inst = db['institutes'].find_one({"email": email})
        history_item = {
            "date": datetime.utcnow().isoformat(),
            "details": inst.get("details", {}),
            "payments": inst.get("payments", {}),
            "documents": inst.get("documents", []),
            "tabulation_file": inst.get("tabulation_file", "")
        }
        db['institutes'].update_one(
            {"email": email}, 
            {
                "$set": {
                    "status": "ready_to_publish"
                }
            }
        )
        
    return jsonify({"message": "Response recorded"}), 200


# ----------------- ADMIN ROUTES -----------------

@app.route('/api/admin/publish', methods=['POST'])
def admin_publish():
    data = request.json
    email = data.get('email', '').strip().lower()
    
    db = get_db()
    inst = db['institutes'].find_one({"email": email})
    if not inst:
        return jsonify({"error": "Institute not found"}), 404
        
    db['institutes'].update_one(
        {"email": email}, 
        {
            "$set": {
                "status": "published"
            }
        }
    )
    send_email(email, "Congratulations! Results Published", "<p>Your results have been officially published! You can now view all your data on your dashboard.</p>")
    
    # Smart Payment Reminder
    payments = inst.get('payments', {})
    total_billed = float(payments.get('total', 0))
    total_paid = float(payments.get('paid', 0))
    balance = total_billed - total_paid
    
    if balance > 0:
        config = db['admin_config'].find_one({"_id": "pricing"}) or {}
        bank_details = config.get("bank_details", {})
        account = bank_details.get("account", "Not provided")
        ifsc = bank_details.get("ifsc", "Not provided")
        phone = bank_details.get("phone", "Not provided")
        
        email_body = f"""
        <p>Dear {inst.get('institute', {}).get('name', 'Institute')},</p>
        <p>Your results have been published, but our records indicate a pending balance of <strong>₹{balance}</strong> on your account.</p>
        <p>Please clear this remaining balance as soon as possible.</p>
        <h3>Official Payment Details:</h3>
        <table style="border-collapse: collapse; width: 100%; max-width: 400px;">
            <tr><td style="padding: 8px; border: 1px solid #ddd;"><strong>Bank Account:</strong></td><td style="padding: 8px; border: 1px solid #ddd;">{account}</td></tr>
            <tr><td style="padding: 8px; border: 1px solid #ddd;"><strong>IFSC Code:</strong></td><td style="padding: 8px; border: 1px solid #ddd;">{ifsc}</td></tr>
            <tr><td style="padding: 8px; border: 1px solid #ddd;"><strong>Phone / UPI:</strong></td><td style="padding: 8px; border: 1px solid #ddd;">{phone}</td></tr>
        </table>
        <p>Thank you for choosing IGYR.</p>
        """
        send_email(email, "Action Required: Pending Payment Reminder", email_body)
    return jsonify({"message": "Results published successfully"}), 200


@app.route('/api/admin/institutes', methods=['GET'])
def admin_get_all():
    # In a real app, verify admin session/token here
    db = get_db()
    institutes_col = db['institutes']
    
    all_insts = list(institutes_col.find({}, {"_id": 0}).sort("email", 1)) # exclude objectId
    return jsonify(all_insts), 200

@app.route('/api/admin/status', methods=['POST'])
def admin_update_status():
    data = request.json
    email = data.get('email', '').strip().lower()
    new_status = data.get('status')
    
    db = get_db()
    institutes_col = db['institutes']
    
    if new_status == 'rejected':
        institutes_col.delete_one({"email": email})
        send_email(email, "Registration Rejected", "<p>We're sorry, your registration to India Get Your Result was rejected by the admin.</p>")
    else:
        institutes_col.update_one({"email": email}, {"$set": {"status": new_status}})
        if new_status == 'approved':
            send_email(email, "Registration Approved!", "<p>Congratulations! Your institution account has been approved. You can now log in and submit results.</p>")
            
    return jsonify({"message": "Status updated successfully"}), 200

@app.route('/api/admin/remove', methods=['DELETE'])
def admin_remove():
    email = request.args.get('email', '').strip().lower()
    
    db = get_db()
    db['institutes'].delete_one({"email": email})
    
    send_email(email, "Account Removed", "<p>Your institution account has been removed from the India Get Your Result hub.</p>")
    
    return jsonify({"message": "Account removed successfully"}), 200

@app.route('/api/admin/mark-task-done', methods=['POST'])
def admin_mark_task_done():
    data = request.json
    email = data.get('email', '').strip().lower()
    
    db = get_db()
    institutes_col = db['institutes']
    
    inst = institutes_col.find_one({"email": email})
    if not inst: return jsonify({"error": "Not found"}), 404
    
    history_item = {
        "date": datetime.utcnow().isoformat(),
        "details": inst.get("details", {}),
        "payments": inst.get("payments", {}),
        "documents": inst.get("documents", []),
        "tabulation_file": inst.get("tabulation_file", "")
    }
    
    institutes_col.update_one(
        {"email": email},
        {
            "$set": {
                "status": "approved",
                "details": {},
                "payments": {"total": 0, "paid": 0, "phases": []},
                "documents": [],
                "tabulation_file": ""
            },
            "$push": {"history": history_item}
        }
    )
    
    send_email(email, "Order Fully Completed!", "<p>Your payments are cleared and your order has been fully closed and archived. You can now submit new results.</p>")
    
    return jsonify({"message": "Task marked as completed and archived"}), 200


@app.route('/api/pricing', methods=['GET'])
def get_pricing():
    db = get_db()
    pricing = db['config'].find_one({"type": "pricing"})
    if not pricing:
        return jsonify({"normal": 50, "excel": 100, "both": 150, "bank_account": "", "ifsc": "", "phone": ""}), 200
    return jsonify({
        "normal": pricing.get("normal", 50),
        "excel": pricing.get("excel", 100),
        "both": pricing.get("both", 150),
        "subject_rate": pricing.get("subject_rate", 0),
        "bank_account": pricing.get("bank_account", ""),
        "ifsc": pricing.get("ifsc", ""),
        "phone": pricing.get("phone", ""),
        "message": pricing.get("message", "")
    }), 200

@app.route('/api/admin/pricing', methods=['POST'])
def update_pricing():
    data = request.json
    db = get_db()
    db['config'].update_one(
        {"type": "pricing"},
        {"$set": {
            "normal": int(data.get("normal", 50)),
            "excel": int(data.get("excel", 100)),
            "both": int(data.get("both", 150)),
            "subject_rate": int(data.get("subject_rate", 0)),
            "bank_account": data.get("bank_account", ""),
            "ifsc": data.get("ifsc", ""),
            "phone": data.get("phone", ""),
            "message": data.get("message", "")
        }},
        upsert=True
    )
    return jsonify({"message": "Pricing updated"}), 200


@app.route('/api/files/<filename>', methods=['GET'])
def download_file(filename):
    return send_from_directory(UPLOAD_FOLDER, filename)

@app.route('/api/admin/upload-tabulation', methods=['POST'])
def admin_upload_tabulation():
    import os
    from werkzeug.utils import secure_filename
    from email_service import send_email_with_attachment
    
    email = request.form.get('email', '').strip().lower()
    if 'file' not in request.files:
        return jsonify({"error": "No file part"}), 400
    file = request.files['file']
    if file.filename == '':
        return jsonify({"error": "No selected file"}), 400
        
    filename = secure_filename("tab_" + email + "_" + file.filename)
    filepath = os.path.join(UPLOAD_FOLDER, filename)
    file.save(filepath)
    
    # 1. Update status to verification_pending (DO NOT save file in DB)
    db = get_db()
    db['institutes'].update_one(
        {"email": email},
        {"$set": {
            "status": "verification_pending",
            "tabulation_file": ""
        }}
    )
    
    # 2. Email the tabulation register directly to the institute
    subject = "Action Required: Verify Your Tabulation Register"
    body = "<p>Your Draft Tabulation Register is ready!</p><p>Please find the attached document for your review. Once you have reviewed it, log back into your portal dashboard and click 'Approve & Publish' to finalize the process.</p>"
    
    success = send_email_with_attachment(email, subject, body, filepath)
    
    # 3. Delete temporary file from server
    try:
        if os.path.exists(filepath):
            os.remove(filepath)
    except Exception as e:
        print("Could delete temp file:", e)
        
    if success:
        return jsonify({"message": "Tabulation uploaded and verification requested via email"}), 200
    else:
        # Revert status
        db['institutes'].update_one({"email": email}, {"$set": {"status": "processing"}})
        return jsonify({"error": "Failed to send email to client."}), 500


@app.route('/api/admin/reject-order', methods=['POST'])
def admin_reject_order():
    data = request.json
    email = data.get('email', '').strip().lower()
    reason = data.get('reason', 'No reason provided')
    
    db = get_db()
    db['institutes'].update_one(
        {"email": email},
        {"$set": {
            "status": "order_rejected",
            "rejection_reason": reason
        }}
    )
    
    email_body = f"<p>Unfortunately, your requested result format and order details have been rejected by the admin.</p><p><strong>Reason:</strong> {reason}</p><p>Please log in to your dashboard to review this and submit a new request if applicable.</p>"
    send_email(email, "Order Request Rejected", email_body)
    
    return jsonify({"message": "Order rejected successfully"}), 200

@app.route('/api/institutes/reapply', methods=['POST'])
def client_reapply():
    data = request.json
    email = data.get('email', '').strip().lower()
    
    db = get_db()
    db['institutes'].update_one(
        {"email": email},
        {"$set": {
            "status": "approved",
            "details": {},
            "rejection_reason": ""
        }}
    )
    
    return jsonify({"message": "Re-apply allowed"}), 200

if __name__ == '__main__':
    # Initialize DB connection on startup
    get_db()
    app.run(host='0.0.0.0', port=5001, debug=True)
