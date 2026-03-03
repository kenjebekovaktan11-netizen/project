import os
from datetime import datetime, timedelta

from dotenv import load_dotenv
load_dotenv()

from flask import Flask, request, jsonify
from flask_cors import CORS
from flask_migrate import Migrate
from flask_sqlalchemy import SQLAlchemy
from flask_jwt_extended import (
    JWTManager, create_access_token, jwt_required, get_jwt_identity
)
from werkzeug.security import generate_password_hash, check_password_hash

import cloudinary
import cloudinary.uploader
from flask_jwt_extended import get_jwt


def create_app():
    app = Flask(__name__)
    CORS(app)

    db_url = os.getenv("DATABASE_URL")
    if not db_url:
       raise RuntimeError("DATABASE_URL is not set")

    if db_url.startswith("postgres://"):
        db_url = db_url.replace("postgres://", "postgresql://", 1)

    app.config["SQLALCHEMY_DATABASE_URI"] = db_url
    app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False

    app.config["JWT_SECRET_KEY"] = os.getenv("JWT_SECRET", "CHANGE_ME_PLEASE")
    app.config["JWT_ACCESS_TOKEN_EXPIRES"] = timedelta(days=7)

    cloudinary.config(
        cloud_name=os.getenv("CLOUDINARY_CLOUD_NAME"),
        api_key=os.getenv("CLOUDINARY_API_KEY"),
        api_secret=os.getenv("CLOUDINARY_API_SECRET"),
        secure=True,
    )
    return app


app = create_app()
db = SQLAlchemy(app)
jwt = JWTManager(app)
migrate = Migrate(app, db)




class User(db.Model):
    __tablename__ = "users"
    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(180), unique=True, nullable=False)
    name = db.Column(db.String(80), nullable=True)
    password_hash = db.Column(db.String(255), nullable=False)
    role = db.Column(db.String(20), nullable=False, default="user")
    created_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)


class Listing(db.Model):
    __tablename__ = "listings"
    id = db.Column(db.Integer, primary_key=True)

    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    user = db.relationship("User", backref="listings")

    brand = db.Column(db.String(80), nullable=False)
    condition = db.Column(db.String(80),nullable=True)
    model = db.Column(db.String(80), nullable=False)
    year = db.Column(db.Integer, nullable=True)
    price = db.Column(db.Integer, nullable=True)
    km = db.Column(db.String(80),nullable=True)
    owner = db.Column(db.String(80),nullable=True)
    engine = db.Column(db.String(80),nullable=True)
    type = db.Column(db.String(40), nullable=True)
    city = db.Column(db.String(80), nullable=True)
    description = db.Column(db.Text, nullable=True)
    created_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)


class ListingImage(db.Model):
    __tablename__ = "listing_images"
    id = db.Column(db.Integer, primary_key=True)

    listing_id = db.Column(db.Integer, db.ForeignKey("listings.id"), nullable=False)
    listing = db.relationship("Listing", backref="images")

    url = db.Column(db.Text, nullable=False)
    public_id = db.Column(db.String(255), nullable=False)
    position = db.Column(db.Integer, nullable=False, default=0)

class UserFavorite(db.Model):
    __tablename__ = "user_favorites"

    id = db.Column(db.Integer, primary_key=True)

    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    listing_id = db.Column(db.Integer, db.ForeignKey("listings.id"), nullable=False)

    __table_args__ = (
        db.UniqueConstraint("user_id", "listing_id", name="unique_user_listing_fav"),
    )




@app.route("/api/me", methods=["GET"])
@jwt_required()
def me():
    user_id = int(get_jwt_identity())
    claims = get_jwt()
    u = User.query.get_or_404(user_id)

    return jsonify({
        "id": u.id,
        "role": claims.get("role", "user"),
        "name": u.name,
        "email": u.email,
        "createdAt": u.created_at.isoformat()
    }), 200

def to_int(x):
    try:
        return int(x)
    except Exception:
        return None


def ensure_admin_from_env():
    admin_email = (os.getenv("ADMIN_EMAIL") or "").strip().lower()
    admin_pass = os.getenv("ADMIN_PASSWORD") or ""
    if not admin_email or not admin_pass:
        return

    existing = User.query.filter_by(email=admin_email).first()
    if existing:
        if existing.role != "admin":
            existing.role = "admin"
            db.session.commit()
        return

    u = User(
        email=admin_email,
        name=admin_email.split("@")[0],
        password_hash=generate_password_hash(admin_pass),
        role="admin",
    )
    db.session.add(u)
    db.session.commit()


# def get_or_create_guest_user_id():
#     guest_email = "guest@local"
#     u = User.query.filter_by(email=guest_email).first()
#     if u:
#         return u.id

#     u = User(
#         email=guest_email,
#         password_hash=generate_password_hash("guest"),
#         role="user",
#     )
#     db.session.add(u)
#     db.session.commit()
#     return u.id


def serialize_listing(l: Listing):
    imgs = sorted(l.images, key=lambda im: im.position)
    return {
        "id": str(l.id),
        "isUser": False,
        "brand": l.brand,
        "model": l.model,
        "year": l.year,
        "condition": l.condition,
        "km": l.km,
        "engine": l.engine,
        "owner": l.owner, 
        "price": l.price,
        "type": l.type,
        "city": l.city,
        "description": l.description,
        "createdAt": l.created_at.isoformat(),
        "images": [im.url for im in imgs],
        "ownerId": l.user_id,
    }


with app.app_context():
    db.create_all()
    ensure_admin_from_env()


# =========================
# Routes
# =========================

@app.route("/health", methods=["GET"])
def health():
    return jsonify({"ok": True})


@app.route("/api/auth/register", methods=["POST"])
def register():
    data = request.get_json(silent=True) or {}

    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""
    name = (data.get("name") or "").strip()

    if not email or not password:
        return jsonify({"error": "email и password обязательны"}), 400

    if not name:
        name = email.split("@")[0]

    if User.query.filter_by(email=email).first():
        return jsonify({"error": "Пользователь уже существует"}), 409

    user = User(
        name=name,
        email=email,
        password_hash=generate_password_hash(password),
        role="user",
    )

    db.session.add(user)
    db.session.commit()

    return jsonify({"success": True}), 201


@app.route("/api/auth/login", methods=["POST"])
def login():
    data = request.get_json(silent=True) or {}
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""

    user = User.query.filter_by(email=email).first()
    if not user or not check_password_hash(user.password_hash, password):
        return jsonify({"error": "Неверные данные"}), 401

    token = create_access_token(
        identity=str(user.id),
        additional_claims={"role": user.role}
    )
    return jsonify({"token": token, "role": user.role, "userId": user.id}), 200




@app.route("/api/cars", methods=["GET"])
def get_cars():
    listings = Listing.query.order_by(Listing.created_at.desc()).all()
    return jsonify([serialize_listing(l) for l in listings])


@app.route("/api/cars/<int:car_id>", methods=["GET"])
def get_car(car_id):
    l = Listing.query.get_or_404(car_id)
    return jsonify(serialize_listing(l))


@app.route("/api/cars", methods=["POST"])
@jwt_required()
def add_car():
    user_id = int(get_jwt_identity())

    form = request.form
    brand = (form.get("brand") or "").strip()
    model = (form.get("model") or "").strip()

    if not brand or not model:
        return jsonify({"error": "brand и model обязательны"}), 400

    listing = Listing(
        user_id=user_id,
        brand=brand,
        model=model,
        year=to_int(form.get("year")),
        price=to_int(form.get("price")),
        owner=form.get("owner"),
        km=form.get("km"),
        condition=form.get("condition"),
        engine=form.get("engine"),
        type=form.get("type"),
        city=form.get("city"),
        description=form.get("description"),
    )
    db.session.add(listing)
    db.session.commit()

    files = request.files.getlist("images")
    if not files:
        files = request.files.getlist("images[]")

    print("CONTENT_TYPE:", request.content_type)
    print("FILES KEYS:", list(request.files.keys()))
    print("FILES(images) =", len(files), [f.filename for f in files])

    for i, f in enumerate(files):
        if not f or not f.filename:
            continue
        try:
            upload = cloudinary.uploader.upload(
                f,
                folder=f"automarket/listings/{listing.id}",
                resource_type="image",
            )
        except Exception as e:
            print("CLOUDINARY UPLOAD ERROR:", repr(e))
            return jsonify({"error": "Cloudinary upload failed", "details": str(e)}), 400

        img = ListingImage(
            listing_id=listing.id,
            url=upload["secure_url"],
            public_id=upload["public_id"],
            position=i,
        )
        db.session.add(img)

    db.session.commit()

    listing = Listing.query.get(listing.id)
    return jsonify(serialize_listing(listing)), 201


@app.route("/api/cars/<int:car_id>", methods=["DELETE"])
@jwt_required()
def delete_car(car_id):
    ident = get_jwt_identity()
    claims = get_jwt()
    user_id = int(ident)
    role = claims.get("role", "user")

    listing = Listing.query.get_or_404(car_id)

    if role != "admin" and listing.user_id != user_id:
        return jsonify({"error": "Нельзя удалить чужое объявление"}), 403

  
    UserFavorite.query.filter_by(listing_id=listing.id).delete()

    images = list(listing.images)
    for im in images:
        try:
            cloudinary.uploader.destroy(im.public_id)
        except Exception:
            pass

    ListingImage.query.filter_by(listing_id=listing.id).delete()
    db.session.delete(listing)
    db.session.commit()

    return jsonify({"success": True}), 200
# =========================
# Favorites (НОВЫЙ БЛОК)
# =========================

@app.route("/api/favorites", methods=["GET"])
@jwt_required()
def get_favorites():
    user_id = int(get_jwt_identity())
    favs = UserFavorite.query.filter_by(user_id=user_id).all()
    return jsonify([str(f.listing_id) for f in favs]), 200


@app.route("/api/favorites/<int:listing_id>", methods=["POST"])
@jwt_required()
def add_favorite(listing_id):
    user_id = int(get_jwt_identity())

    listing = Listing.query.get_or_404(listing_id)

    exists = UserFavorite.query.filter_by(
        user_id=user_id,
        listing_id=listing.id
    ).first()

    if exists:
        return jsonify({"success": True, "already": True}), 200

    fav = UserFavorite(user_id=user_id, listing_id=listing.id)
    db.session.add(fav)
    db.session.commit()

    return jsonify({"success": True}), 201


@app.route("/api/favorites/<int:listing_id>", methods=["DELETE"])
@jwt_required()
def delete_favorite(listing_id):
    user_id = int(get_jwt_identity())

    fav = UserFavorite.query.filter_by(
        user_id=user_id,
        listing_id=listing_id
    ).first()

    if not fav:
        return jsonify({"success": True}), 200

    db.session.delete(fav)
    db.session.commit()

    return jsonify({"success": True}), 200


if __name__ == "__main__":
      
    port = int(os.getenv("PORT", "5000"))
    app.run(host="0.0.0.0", port=port, debug=False)