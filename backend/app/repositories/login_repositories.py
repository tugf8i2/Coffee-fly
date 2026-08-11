from app.models.usuario_models import Usuario

def login_get_user_by_email(db, email):
    return db.query(Usuario).filter(
        Usuario.correo_usuario.ilike(email.strip())
    ).first()