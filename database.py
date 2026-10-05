from pymongo import MongoClient
import certifi
import os

MONGO_URI = os.getenv("MONGO_URI", "mongodb+srv://indiagetyourresult_db_user:BNj1IThbrIW3fGYX@cluster0.ypswhpz.mongodb.net/?appName=Cluster")

client = None
db = None

def init_db():
    global client, db
    try:
        # certifi is required on macOS to avoid SSL handshake issues
        client = MongoClient(MONGO_URI, tlsCAFile=certifi.where())
        db = client["indiagetyourresult"]
        print("✅ Successfully connected to MongoDB!")
    except Exception as e:
        print(f"❌ Failed to connect to MongoDB: {e}")

def get_db():
    if db is None:
        init_db()
    return db
