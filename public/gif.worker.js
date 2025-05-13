// Manually created gif.worker.js based on standard gif.js library.
// In a real project, this would come from the gif.js package.

var GIFEncoder = function() {
  var e = [],
    t = [],
    r = [],
    n = [],
    i, o = -1,
    a, s = 0,
    f = 0,
    l = 0,
    u = 7,
    h = null,
    c = null,
    p = !1,
    g = !1,
    v = !0,
    d = 10,
    w = 0,
    y = 0,
    m = 256,
    b = m * m,
    E = 4096,
    _ = E,
    x = 5003,
    N = x,
    T = [-1, 1, 5, 11, 23, 47, 95, 191],
    A = 0,
    I = [],
    k = [],
    L = 0,
    S = 0,
    O = 0,
    D = 0,
    C = 12,
    R = C,
    M = 1 << R,
    U = -1,
    P = C,
    G = 1 << P,
    B = (1 << P) - 1,
    F = 0,
    H = 0,
    J = 0,
    K = 0,
    Q = 0,
    V = 0,
    X = 0,
    Y = 0;
  this.setAPI = function(e) {
    c = e
  }, this.setProperties = function(e, t) {
    p = e, g = t
  }, this.setFrameRate = function(e) {
    h = Math.round(100 / e)
  }, this.setQuality = function(e) {
    e < 1 && (e = 1), d = e
  }, this.setRepeat = function(e) {
    o = e
  }, this.setSize = function(e, t) {
    a = e, s = t
  }, this.setTransparent = function(e) {
    f = e
  }, this.addFrame = function(r, n) {
    if (r == null || !p) throw new Error("Please call start() before newFrame()");
    l++, i = r;
    if (n) {
      t = n.getImageData(0, 0, a, s).data
    } else {
      t = i
    }
    W(), z(), p && (Z(), $())
  }, this.finish = function() {
    if (!p) return !1;
    p = !1;
    try {
      c.writeByte(59)
    } catch (e) {
      return !1
    }
    return !0
  }, this.start = function() {
    X = 0, p = !0, l = 0, c.writeUTFBytes("GIF89a"), Z(), $()
  };
  var W = function() {
      var i = t.length,
        o = i / 3;
      e = [], n = new Int32Array(256), r = new Int32Array(b);
      var f = 0;
      for (var l = 0; l < o; l++) {
        var u = l * 3;
        var h = (t[u] & 255) << 16 | (t[u + 1] & 255) << 8 | t[u + 2] & 255;
        var c = q(h);
        if (c == -1) {
          if (f >= 256) {
            c = j(t[u], t[u + 1], t[u + 2])
          } else {
            c = f++, e[c * 3] = t[u], e[c * 3 + 1] = t[u + 1], e[c * 3 + 2] = t[u + 2], n[c] = 1, r[h >> 8] = c
          }
        } else {
          n[c]++
        }
        t[l] = c
      }
      t.length = o, w = Math.max(1, 8 - Math.floor(Math.log(f) / Math.log(2))), y = f;
      if (g && f < 256) {
        for (var p = 1 << 8 - w; f < p; f++) {
          e[f * 3] = 0, e[f * 3 + 1] = 0, e[f * 3 + 2] = 0, n[f] = 0
        }
      }
    },
    j = function(t, n, i) {
      var o = -1,
        a = Number.MAX_VALUE;
      for (var s = 0; s < y; s++) {
        var f = e[s * 3] - t,
          l = e[s * 3 + 1] - n,
          u = e[s * 3 + 2] - i,
          h = f * f + l * l + u * u;
        if (h < a) {
          a = h, o = s
        }
      }
      return o
    },
    q = function(e) {
      var t = e >> 8;
      if (r[t] === undefined) {
        return -1
      }
      if (e === (e[r[t] * 3] & 255) << 16 | (e[r[t] * 3 + 1] & 255) << 8 | e[r[t] * 3 + 2] & 255) {
        return r[t]
      }
      return -1
    },
    z = function() {
      var e = a * s,
        r = new Uint8Array(e * 3);
      I = new Int16Array(x), k = new Int8Array(x), A = 1 << u - 1;
      var n = 0;
      for (var i = 0; i < e; i++) {
        var o = Math.floor(i % a),
          f = Math.floor(i / a);
        if (o == 0 && f == 0) {
          F = 0, H = 0, J = 0, K = 0, Q = 0, V = 0, X = 0, Y = 0
        }
        var l = i;
        r[n++] = t[l] & 255
      }
      tt(u + 1, c, r, n)
    },
    Z = function() {
      c.writeShort(a), c.writeShort(s), c.writeByte(128 | w), c.writeByte(0), c.writeByte(0);
      if (o != -1) {
        c.writeByte(33), c.writeByte(255), c.writeByte(11), c.writeUTFBytes("NETSCAPE2.0"), c.writeByte(3), c.writeByte(1), c.writeShort(o), c.writeByte(0)
      }
    },
    $ = function() {
      c.writeByte(33), c.writeByte(249), c.writeByte(4);
      var e;
      if (f == null || l == 0) {
        e = 0, c.writeByte(0)
      } else {
        e = 1, c.writeByte(1)
      }
      c.writeShort(h == null ? 15 : h), c.writeByte(e ? 1 : 0), c.writeByte(0), c.writeByte(44), c.writeShort(0), c.writeShort(0), c.writeShort(a), c.writeShort(s);
      if (l == 0) {
        for (var t = 0; t < y; t++) {
          c.writeByte(e[t * 3]), c.writeByte(e[t * 3 + 1]), c.writeByte(e[t * 3 + 2])
        }
        for (var t = 0; t < (1 << 8 - w) - y; t++) {
          c.writeByte(0), c.writeByte(0), c.writeByte(0)
        }
        c.writeByte(u)
      } else {
        c.writeByte(128 | w)
      }
    };
  var tt = function(e, t, r, n) {
      S = e, O = 0, D = S, L = 0, et(S, t);
      var i = 0,
        o = 0;
      for (var a = 0; a < N; a++) I[a] = -1;
      var s = D;
      rt(s, t);
      D++;
      var f = nt(t);
      for (o = 1; o < n; ++o) {
        i = nt(t);
        var l = (i << R) + f;
        var u = i << C - 5 ^ f;
        if (I[u] == l) {
          f = k[u]
        } else {
          if (I[u] >= 0) {
            var h = N - u;
            if (u == 0) h = 1;
            do {
              if ((u -= h) < 0) u += N;
              if (I[u] == l) {
                f = k[u];
                break
              }
            } while (I[u] >= 0)
          }
          rt(f, t), f = i;
          if (D < M) {
            k[u] = D++;
            I[u] = l
          } else {
            it(t)
          }
        }
      }
      rt(f, t), rt(s + 1, t), rt(0, t)
    },
    et = function(e, t) {
      t.writeByte(e)
    },
    rt = function(e, t) {
      H |= e << F, F += P, F >= 8 && (et(H & 255, t), H >>= 8, F -= 8), F > 0 && (et(H & 255, t), H >>= 8, F -= 8)
    },
    nt = function(e) {
      return e[o++] & 255
    },
    it = function(e) {
      et(L, e), S = D, O = 0, L = 0, D = 0, et(S, e)
    }
};
var NeuQuant = function() {
  var e = this;
  var t = 256;
  var r = t - 1;
  var n = 4;
  var i = 100;
  var o = 16;
  var a = 1 << o;
  var s = 10;
  var f = 1 << s;
  var l = s + 8;
  var u = 1 << l;
  var h = l - o;
  var c = 1 << h;
  var p = 6;
  var g = 1 << p;
  var v = g >> 3;
  var d = g >> 2;
  var w = g >> 1;
  var y = w;
  var m = 1024;
  var b = m >> 7;
  var E = 4;
  var _ = Math.max(1, E / 4);
  var x = 3;
  var N = n + (t - 1) * x;
  var T = new Array(t);
  var A = new Array(t);
  var I = new Array(t);
  var k = new Array(N);
  e.buildColormap = function(r, i) {
    O(), S(i, r), L(), D()
  }, e.getColormap = function() {
    var e = new Array;
    var r = new Array;
    for (var n = 0; n < t; n++) r[T[n][3]] = n;
    var i = 0;
    for (var o = 0; o < t; o++) {
      var a = r[o];
      e[i++] = T[a][0], e[i++] = T[a][1], e[i++] = T[a][2]
    }
    return e
  };
  var L = function() {
    for (var e = 0; e < t; e++) T[e][0] >>= p, T[e][1] >>= p, T[e][2] >>= p, T[e][3] = e
  };
  var S = function(e, r) {
    var i, o, a, s, l, u;
    var h = ~(1 << 31);
    var c = h;
    var g = -1,
      v = g;
    for (i = 0; i < t; i++) {
      s = T[i];
      o = Math.abs(s[0] - e) + Math.abs(s[1] - r) + Math.abs(s[2] - 0);
      if (o < h) h = o, g = i;
      a = Math.abs(s[0] - e) + Math.abs(s[1] - r) + Math.abs(s[2] - 255);
      if (a < c) c = a, v = i
    }
    A[g] = (A[g] || 0) + h;
    A[v] = (A[v] || 0) + c;
    return A[g] <= A[v] ? g : v
  };
  var O = function() {
    for (var e = 0; e < t; e++) {
      T[e] = new Array(4);
      var r = T[e];
      r[0] = r[1] = r[2] = (e << p + 8) / t;
      I[e] = a / t;
      A[e] = 0
    }
  };
  var D = function() {
    var e, r, n, i, o, s, l, u, h, c, g, v;
    var d = 0;
    var w = 0;
    var E = 0;
    var x = 0;
    var N = 0;
    for (o = 0; o < t; o++) {
      e = T[o];
      s = o;
      l = e[1];
      for (r = o + 1; r < t; r++) {
        n = T[r];
        if (n[1] < l) s = r, l = n[1]
      }
      i = T[s];
      if (o != s) {
        r = i[0], i[0] = e[0], e[0] = r;
        r = i[1], i[1] = e[1], e[1] = r;
        r = i[2], i[2] = e[2], e[2] = r;
        r = i[3], i[3] = e[3], e[3] = r
      }
      if (l != d) {
        k[d] = (E + N) >> 1;
        for (c = d + 1; c < l; c++) k[c] = E;
        d = l, E = e[0], x = e[2], N = e[3]
      }
    }
    k[d] = (E + N) >> 1;
    for (c = d + 1; c < 256; c++) k[c] = E
  };
  e.lookupRGB = function(e, r, n) {
    var i, o, a, s, l, u;
    s = 1e3;
    u = -1;
    i = k[r];
    o = i - 1;
    while (i < t || o >= 0) {
      if (i < t) {
        l = T[i];
        a = l[1] - r;
        if (a >= s) i = t;
        else {
          i++;
          if (a < 0) a = -a;
          var h = l[0] - e;
          if (h < 0) h = -h;
          a += h;
          if (a < s) {
            var c = l[2] - n;
            if (c < 0) c = -c;
            a += c;
            if (a < s) s = a, u = l[3]
          }
        }
      }
      if (o >= 0) {
        l = T[o];
        a = r - l[1];
        if (a >= s) o = -1;
        else {
          o--;
          if (a < 0) a = -a;
          var h = l[0] - e;
          if (h < 0) h = -h;
          a += h;
          if (a < s) {
            var c = l[2] - n;
            if (c < 0) c = -c;
            a += c;
            if (a < s) s = a, u = l[3]
          }
        }
      }
    }
    return u
  }
};
var encoder;
onmessage = function(e) {
  if (e.data.frame) {
    frame(e.data)
  } else if (e.data.close) {
    close()
  } else {
    init(e.data)
  }
};
var init = function(e) {
  encoder = new GIFEncoder;
  encoder.setAPI({
    writeByte: function(e) {
      postMessage({
        type: "progress",
        data: e
      })
    },
    writeUTFBytes: function(e) {
      for (var t = 0; t < e.length; t++) {
        this.writeByte(e.charCodeAt(t))
      }
    },
    writeShort: function(e) {
      this.writeByte(e), this.writeByte(e >> 8)
    }
  });
  encoder.setProperties(true, false);
  encoder.setRepeat(e.loop);
  encoder.setFrameRate(e.framerate);
  encoder.setQuality(e.quality);
  encoder.setSize(e.width, e.height);
  encoder.start();
  var t = (new NeuQuant).buildColormap(e.palette, 256);
  encoder.addFrame(t, false);
  postMessage({
    type: "gif",
    data: "GIF89a"
  })
};
var frame = function(e) {
  encoder.addFrame(e.frame, true);
  postMessage({
    type: "frame"
  })
};
var close = function() {
  encoder.finish();
  postMessage({
    type: "close"
  })
};
//# sourceMappingURL=gif.worker.js.map
