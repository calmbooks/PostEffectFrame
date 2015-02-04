
(function( win, doc ) {

    var FPS = 60;
    var canvas = doc.getElementById("c");

    var gl = canvas.getContext("webgl") || canvas.getContext("experimental-webgl");

    //-----------------------
    // Main
    //-----------------------        
    function Main() {

        this.init();
    }

    Main.prototype.init = function() {

        var frame = new Frame();

        this.renderer = new Renderer(canvas);

        this.renderer.addTarget(frame);
        this.renderer.setup_update();

        this.setResize();
    };

    Main.prototype.setResize = function() {
        win.addEventListener("resize", this.resize.bind(this), false);
        this.resize()
    };

    Main.prototype.resize = function() {
        this.renderer.resize(win.innerWidth, win.innerHeight);
    };


    //-----------------------
    // Renderer
    //-----------------------        
    function Renderer( canvas ) {
        this.canvas = canvas;
        this.init()
    }

    Renderer.prototype.now = ( win.performance && ( performance.now || performance.mozNow || performance.webkitNow ) ) || Date.now;

    Renderer.prototype.init = function() {

        this.runTime = 0;
        this.resolution = [0,0];

        gl.enable(gl.CULL_FACE);
        gl.depthFunc(gl.LEQUAL);

        this.camera = new Camera();
    };

    Renderer.prototype.addTarget = function( target ) {
        this.target = target;
    };

    Renderer.prototype.get_time = function( target ) {
        return this.now.call( win.performance );
    };

    Renderer.prototype.resize = function( w, h ) {
        this.width = w;
        this.height = h;

        this.canvas.width = this.width;
        this.canvas.height = this.height;

        gl.viewport(0, 0, this.width, this.height);

        this.resolution = [ this.width, this.height ];
    };

    Renderer.prototype.setup_update = function() {
        this.timeout_id = null;
        this.last_time = this.get_time();
        
        this.update();
    };

    Renderer.prototype.update = function() {

        if( this.timeout_id != null ) return;

        var now_time = this.get_time();

        this.runTime += (now_time - this.last_time);

        this.view_matrix = Matrix4.get_view(this.camera.position, this.camera.target, this.camera.top);

        this.target.update(this.view_matrix, this.runTime, this.resolution);

        this.timeout_id = setTimeout(function() {

            this.timeout_id = null;
            this.update()

        }.bind(this), 1000 / FPS);

        this.last_time = now_time;
    };


    //-----------------------
    // Camera
    //-----------------------        
    function Camera() {}

    Camera.prototype.position = [ 0, 0, 1 ];
    Camera.prototype.target = [ 0, 0, 0 ];
    Camera.prototype.top = [ 0, 1, 0 ];


    //-----------------------
    // Frame
    //-----------------------        
    function Frame() {

        this.init();
    }

    Frame.prototype.init = function() {

        this.vertex_position = [
            -1.0,  1.0, 0.0,
             1.0,  1.0, 0.0,
            -1.0, -1.0, 0.0,
             1.0, -1.0, 0.0
        ];

        this.vertex_index = [
            0, 2, 1,
            1, 2, 3
        ];

        this.position = [ 0.0, 0.0, 0.0 ];

        this.shader = new Shader();
        this.ibo = this.create_ibo(this.vertex_index);
    };

    Frame.prototype.create_vbo = function( data ) {

        var vbo = gl.createBuffer()

        gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data), gl.STATIC_DRAW);
        gl.bindBuffer(gl.ARRAY_BUFFER, null);

        return vbo;
    };

    Frame.prototype.create_ibo = function( data ) {

        var ibo = gl.createBuffer();

        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibo);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Int16Array(data), gl.STATIC_DRAW);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);

        return ibo;
    };

    Frame.prototype.update = function( view_matrix, runTime, resolution ) {

        var position_vbo = this.create_vbo(this.vertex_position);

        this.model_matrix = Matrix4.get_translate(this.position);

        this.mv_matrix = Matrix4.get_multiply(this.model_matrix, view_matrix);

        this.shader.update(position_vbo, this.mv_matrix, runTime, resolution);

        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.ibo);

        this.render();
    };

    Frame.prototype.render = function() {
        gl.drawElements(gl.TRIANGLES, this.vertex_index.length, gl.UNSIGNED_SHORT, 0);
    };


    //-----------------------
    // Shader
    //-----------------------
    function Shader() {

        this.init();
    }

    Shader.prototype.init = function() {

        var v_shader = this.create_shader("vertexShader");
        var f_shader = this.create_shader("fragmentShader");

        this.program = this.create_program(v_shader, f_shader);

        this.attribute_location = {
            position : gl.getAttribLocation(this.program, "position")
        };

        this.uniform_location = {
            mv_matrix : gl.getUniformLocation(this.program, "mv_matrix"),
            resolution : gl.getUniformLocation(this.program, "resolution"),
            time : gl.getUniformLocation(this.program, "time")
        };
    };

    Shader.prototype.create_shader = function( id ) {

        var element = doc.getElementById(id);

        if( element.type == "x-shader/x-vertex" ) {

            var shader = gl.createShader(gl.VERTEX_SHADER);
        }
        else if( element.type == "x-shader/x-fragment" ) {

            var shader = gl.createShader(gl.FRAGMENT_SHADER);
        } 
        else {
            return
        }

        gl.shaderSource(shader, element.text);
        gl.compileShader(shader);

        return shader;
    };

    Shader.prototype.create_program = function( vs, fs ) {

        var program = gl.createProgram();

        gl.attachShader(program, vs);
        gl.attachShader(program, fs);

        gl.linkProgram(program);
        gl.useProgram(program);

        return program;
    };

    Shader.prototype.set_attribute = function( vbo, location, stride ) {

        gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
        gl.enableVertexAttribArray(location);
        gl.vertexAttribPointer(location, stride, gl.FLOAT, false, 0, 0);
    };

    Shader.prototype.reset_attribute = function( location ) {

        gl.disableVertexAttribArray(location);
    };

    Shader.prototype.update = function( position_vbo, mv_matrix, runTime, resolution ) {

        gl.useProgram(this.program);

        this.set_attribute(position_vbo, this.attribute_location.position, 3);

        gl.uniformMatrix4fv(this.uniform_location.mv_matrix, false, mv_matrix);
        gl.uniform2fv(this.uniform_location.resolution, resolution);
        gl.uniform1f(this.uniform_location.time, runTime * 0.001);
    };

    //-----------------------
    // Matrix4
    //-----------------------
    function Matrix4() {

        throw "Matrix4 cant be instantiated.";
    };

    Matrix4.create = function() {

        return this.identity();
    };

    Matrix4.identity = function() {

        var dest = [

            1, 0, 0, 0,
            0, 1, 0, 0,
            0, 0, 1, 0,
            0, 0, 0, 1
        ];

        return dest;
    };

    Matrix4.get_multiply = function( mat_a, mat_b ) {

        var a11 =  mat_a[0], a12 =  mat_a[1], a13 =  mat_a[2], a14 =  mat_a[3];
        var a21 =  mat_a[4], a22 =  mat_a[5], a23 =  mat_a[6], a24 =  mat_a[7];
        var a31 =  mat_a[8], a32 =  mat_a[9], a33 = mat_a[10], a34 = mat_a[11];
        var a41 = mat_a[12], a42 = mat_a[13], a43 = mat_a[14], a44 = mat_a[15];

        var b11 =  mat_b[0], b12 =  mat_b[1], b13 =  mat_b[2], b14 =  mat_b[3];
        var b21 =  mat_b[4], b22 =  mat_b[5], b23 =  mat_b[6], b24 =  mat_b[7];
        var b31 =  mat_b[8], b32 =  mat_b[9], b33 = mat_b[10], b34 = mat_b[11];
        var b41 = mat_b[12], b42 = mat_b[13], b43 = mat_b[14], b44 = mat_b[15];

        var dest = [

            a11 * b11 + a12 * b21 + a13 * b31 + a14 * b41,
            a11 * b12 + a12 * b22 + a13 * b32 + a14 * b42,
            a11 * b13 + a12 * b23 + a13 * b33 + a14 * b43,
            a11 * b14 + a12 * b24 + a13 * b34 + a14 * b44,

            a21 * b11 + a22 * b21 + a23 * b31 + a24 * b41,
            a21 * b12 + a22 * b22 + a23 * b32 + a24 * b42,
            a21 * b13 + a22 * b23 + a23 * b33 + a24 * b43,
            a21 * b14 + a22 * b24 + a23 * b34 + a24 * b44,

            a31 * b11 + a32 * b21 + a33 * b31 + a34 * b41,
            a31 * b12 + a32 * b22 + a33 * b32 + a34 * b42,
            a31 * b13 + a32 * b23 + a33 * b33 + a34 * b43,
            a31 * b14 + a32 * b24 + a33 * b34 + a34 * b44,

            a41 * b11 + a42 * b21 + a43 * b31 + a44 * b41,
            a41 * b12 + a42 * b22 + a43 * b32 + a44 * b42,
            a41 * b13 + a42 * b23 + a43 * b33 + a44 * b43,
            a41 * b14 + a42 * b24 + a43 * b34 + a44 * b44
        ];

        return dest;
    };

    Matrix4.get_scale = function( vec ) {

        var x = vec[0];
        var y = vec[1];
        var z = vec[2];

        var dest = [

            x, 0, 0, 0,
            0, y, 0, 0,
            0, 0, z, 0,
            0, 0, 0, 1
        ];

        return dest;
    };

    Matrix4.get_rotate_x = function( angle ) {

        var s = Math.sin(angle);
        var c = Math.cos(angle);

        var dest = [

            1,  0, 0, 0,
            0,  c, s, 0,
            0, -s, c, 0,
            0,  0, 0, 1
        ];

        return dest;
    };

    Matrix4.get_rotate_y = function( angle ) {

        var s = Math.sin(angle);
        var c = Math.cos(angle);

        var dest = [

            c, 0, -s, 0,
            0, 1,  0, 0,
            s, 0,  c, 0,
            0, 0,  0, 1
        ];

        return dest;
    };

    Matrix4.get_rotate_z = function( angle ) {

        var s = Math.sin(angle);
        var c = Math.cos(angle);

        var dest = [

             c, s, 0, 0,
            -s, c, 0, 0,
             0, 0, 1, 0,
             0, 0, 0, 1
        ];

        return dest;
    };

    Matrix4.get_translate = function( vec ) {

        var x = vec[0];
        var y = vec[1];
        var z = vec[2];

        var dest = [

            1, 0, 0, 0,
            0, 1, 0, 0,
            0, 0, 1, 0,
            x, y, z, 1
        ];

        return dest;
    };

    Matrix4.get_view = function( position, target, top ) {

        var x1 = position[0] - target[0];
        var y1 = position[1] - target[1];
        var z1 = position[2] - target[2];

        var l1 = Math.sqrt(( x1 * x1 ) + ( y1 * y1 ) + ( z1 * z1 ));

        var zx = x1 / l1;
        var zy = y1 / l1;
        var zz = z1 / l1;

        var x2 = ( top[1] * zz ) - ( top[2] * zy );
        var y2 = ( top[2] * zx ) - ( top[0] * zz );
        var z2 = ( top[0] * zy ) - ( top[1] * zx );

        var l2 = Math.sqrt(( x2 * x2 ) + ( y2 * y2 ) + ( z2 * z2 ));

        var xx = x2 / l2;
        var xy = y2 / l2;
        var xz = z2 / l2;

        var x3 = ( zy * xz ) - ( zz * xy );
        var y3 = ( zz * xx ) - ( zx * xz );
        var z3 = ( zx * xy ) - ( zy * xx );

        var l3 = Math.sqrt(( x3 * x3 ) + ( y3 * y3 ) + ( z3 * z3 ));

        var yx = x3 / l3;
        var yy = y3 / l3;
        var yz = z3 / l3;

        var px = ( position[0] * xx ) + ( position[1] * xy ) + ( position[2] * xz );
        var py = ( position[0] * yx ) + ( position[1] * yy ) + ( position[2] * yz );
        var pz = ( position[0] * zx ) + ( position[1] * zy ) + ( position[2] * zz );

        var dest = [

             xx,  xy,  xz, 0,
             yx,  yy,  yz, 0,
             zx,  zy,  zz, 0,
            -px, -py, -pz, 1
        ];

        return dest;
    };

    Matrix4.get_projection = function( fov, aspect, near, far ) {

        var rad = ( Math.PI / 180 ) * fov;

        var m22 = 1 / Math.tan( rad / 2 );
        var m11 = m22 / aspect;
        var m33 = -far / ( far - near );
        var m34 = -( far * near ) / ( far - near );

        var dest = [

            m11,   0,   0,  0,
              0, m22,   0,  0,
              0,   0, m33, -1,
              0,   0, m34,  0
        ];

        return dest;
    };

    Matrix4.get_inverse = function( mat ) {

        var a11 =  mat[0], a12 =  mat[1], a13 =  mat[2], a14 =  mat[3];
        var a21 =  mat[4], a22 =  mat[5], a23 =  mat[6], a24 =  mat[7];
        var a31 =  mat[8], a32 =  mat[9], a33 = mat[10], a34 = mat[11];
        var a41 = mat[12], a42 = mat[13], a43 = mat[14], a44 = mat[15];

        var n1  = a11 * a22 - a12 * a21, n2  = a11 * a23 - a13 * a21;
        var n3  = a11 * a24 - a14 * a21, n4  = a12 * a23 - a13 * a22;
        var n5  = a12 * a24 - a14 * a22, n6  = a13 * a24 - a14 * a23;
        var n7  = a31 * a42 - a32 * a41, n8  = a31 * a43 - a33 * a41;
        var n9  = a31 * a44 - a34 * a41, n10 = a32 * a43 - a33 * a42;
        var n11 = a32 * a44 - a34 * a42, n12 = a33 * a44 - a34 * a43;

        var b11 = a22 *  n12 - a23 * n11 + a24 * n10;
        var b12 = a12 * -n12 + a13 * n11 - a14 * n10;
        var b13 = a42 *  n6  - a43 * n5  + a44 *  n4;
        var b14 = a32 * -n6  + a33 * n5  - a34 *  n4;
        var b21 = a21 * -n12 + a23 * n9  - a24 *  n8;
        var b22 = a11 *  n12 - a13 * n9  + a14 *  n8;
        var b23 = a41 * -n6  + a43 * n3  - a44 *  n2;
        var b24 = a31 *  n6  - a33 * n3  + a34 *  n2;
        var b31 = a21 *  n11 - a22 * n9  + a24 *  n7;
        var b32 = a11 * -n11 + a12 * n9  - a14 *  n7;
        var b33 = a41 *  n5  - a42 * n3  + a44 *  n1;
        var b34 = a31 * -n5  + a32 * n3  - a34 *  n1;
        var b41 = a21 * -n10 + a22 * n8  - a23 *  n7;
        var b42 = a11 *  n10 - a12 * n8  + a13 *  n7;
        var b43 = a41 * -n4  + a42 * n2  - a43 *  n1;
        var b44 = a31 *  n4  - a32 * n2  + a33 *  n1;

        var det = a11 * b11 + a21 * b12 + a31 * b13 + a41 * b14;

        var dest = [

            b11 / det, b12 / det, b13 / det, b14 / det,
            b21 / det, b22 / det, b23 / det, b24 / det,
            b31 / det, b32 / det, b33 / det, b34 / det,
            b41 / det, b42 / det, b43 / det, b44 / det
        ];

        return dest;
    };

    win.addEventListener( "load", function() {

        new Main();

    } ,false);

}(window, document));
