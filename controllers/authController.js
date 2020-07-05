const passport = require('passport');
const Usuarios = require('../models/Usuarios');
const Sequelize = require('sequelize');
const Op = Sequelize.Op;
const crypto = require('crypto');
const bcrypt = require('bcrypt-nodejs');
const enviarEmail = require('../handlers/email');

// autenticar el usuario
exports.autenticarUsuario = passport.authenticate('local', {
    successRedirect: '/',
    failureRedirect: '/iniciar-sesion',
    failureFlash: true,
    badRequestMessage: 'Ambos Campos son Obligatorios'
});

//funcion para revisar si el usuario esta logueado o no
exports.usuarioAutenticado = (req, res, next) => {
        //Si el usuario esta autenticado adelandte
        if (req.isAuthenticated()) {
            return next();
        }
        //sino redirigir al formulario
        return res.redirect('/iniciar-sesion');
    }
    //funcion para cerrar funcion
exports.cerrarSesion = (req, res) => {
        req.session.destroy(() => {
            res.redirect('/iniciar-sesion')
        });
    }
    // genera un token si el usuario es valido
exports.enviarToken = async(req, res) => {
    // verificar que el usuario existe
    const { email } = req.body
    const usuario = await Usuarios.findOne({ where: { email } });

    // Si no existe el usuario
    if (!usuario) {
        req.flash('error', 'No existe esa cuenta');
        res.redirect('/reestablecer');
    }
    //usuario existe
    usuario.token = crypto.randomBytes(20).toString('hex');
    //Expiracion
    usuario.expiracion = Date.now() + 3600000;

    //guardarlos en la base de datos
    await usuario.save();

    // url de reset
    const resetUrl = (`http://${req.headers.host}/reestablecer/${usuario.token}`);

    // Enviar el Correo con el Token
    await enviarEmail.enviar({
        usuario,
        subject: 'Password Reset',
        resetUrl,
        archivo: 'reestablecer-password'
    });

    //terminar
    req.flash('correcto', 'Se envió un mensaje a tu correo');
    res.redirect('/iniciar-sesion');

}
exports.validarToken = async(req, res) => {
        const usuario = await Usuarios.findOne({
            where: {
                token: req.params.token
            }
        });
        //sino encuentra el usuario
        if (!usuario) {
            req.flash('error', 'No Válido');
            res.redirect('/reestablecer');
        }

        //Formulario para reestablecer password
        res.render('resetPassword', {
            nombrePagina: 'Reestablecer Contraseña'
        });
    }
    //cambia el password por uno nuevo
exports.actualizarPassword = async(req, res) => {
    //verificar el token valido pero tambien la fecha de expiración
    const usuario = await Usuarios.findOne({
        token: req.params.token,
        expiracion: {
            [Op.gte]: Date.now()
        }
    });

    //verificamos si el usuario existe
    if (!usuario) {
        req.flash('error', 'No Válido');
        res.redirect('/reestablecer');
    }

    //hashear el password
    usuario.password = bcrypt.hashSync(req.body.password, bcrypt.genSaltSync(10));
    usuario.token = null;
    usuario.expiracion = null;

    //guardamos el nuevo
    await usuario.save();
    req.flash('correcto', 'Tu password se ha modificado correctamente');
    res.redirect('/iniciar-sesion');
}