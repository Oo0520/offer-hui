/********************************************************************************
 * css、js公共引用
 */
//document.write('<link rel="stylesheet" href="resources/toastr/build/toastr.min.css" />');
//document.write('<script src="resources/toastr/build/toastr.min.js"></script>');

function checkMobile(str) {
	var re = /(^0{0,1}1[3|4|5|6|7|8|9][0-9]{9}$)/;
	if (re.test(str)) {
		return true
	} else {
		return false
	}
}
function checkEmail(str) {
	var re = /^[_\.0-9a-z-]+@([0-9a-z][0-9a-z-]+\.){1,4}[a-z]{2,3}$/;
	if (re.test(str)) {
		return true
	} else {
		return false
	}
}

function uuid() {
	var s = [];
	var hexDigits = "0123456789abcdef";
	for (var i = 0; i < 32; i++) {
		s[i] = hexDigits.substr(Math.floor(Math.random() * 0x10), 1);
	}
	s[14] = "4"; // bits 12-15 of the time_hi_and_version field to 0010
	s[19] = hexDigits.substr((s[19] & 0x3) | 0x8, 1); // bits 6-7 of the clock_seq_hi_and_reserved to 01
	//s[8] = s[13] = s[18] = s[23] = "-";

	var uuid2 = s.join("");
	return uuid2;
}


//MD5加密
function encrypt(ssoToken,url){
	url += "/common/encrypt"
	var resDate = "";
	$.ajax({
		async: false,
		url:url,
		type:"POST",
		contentType : "application/json",
		data :JSON.stringify({ssoToken : ssoToken}),
		success:function(result){
			var res = JSON.parse(result);
			resDate = res.ssoToken;
			console.log(resDate);
		},
		error : function(){
			toastr["error"]("MD5加密失败","提示");
		}
	});
	return resDate;
}
	
//MD5解密
function decrypt(ssoToken,url){
	url += "/common/decrypt"
	var resDate = "";
	$.ajax({
		async: false,
		url:url,
		type:"POST",
		contentType : "application/json",
		data :JSON.stringify({ssoToken : ssoToken}),
		success:function(result){
			var res = JSON.parse(result);
			resDate = res.ssoToken;
		},
		error : function(){
			toastr["error"]("MD5解密失败","提示");
		}
	});
	return resDate;
}
function jm(a){
	return new Base64().encode(a);
}
function Base64() {
	 
	// private property
	_keyStr = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789`~-";
 
	// public method for encoding
	this.encode = function (input) {
		var output = "";
		var chr1, chr2, chr3, enc1, enc2, enc3, enc4;
		var i = 0;
		input = _utf8_encode(input);
		while (i < input.length) {
			chr1 = input.charCodeAt(i++);
			chr2 = input.charCodeAt(i++);
			chr3 = input.charCodeAt(i++);
			enc1 = chr1 >> 2;
			enc2 = ((chr1 & 3) << 4) | (chr2 >> 4);
			enc3 = ((chr2 & 15) << 2) | (chr3 >> 6);
			enc4 = chr3 & 63;
			if (isNaN(chr2)) {
				enc3 = enc4 = 64;
			} else if (isNaN(chr3)) {
				enc4 = 64;
			}
			output = output +
			_keyStr.charAt(enc1) + _keyStr.charAt(enc2) +
			_keyStr.charAt(enc3) + _keyStr.charAt(enc4);
		}
		return output;
	}
 
	// public method for decoding
	this.decode = function (input) {
		var output = "";
		var chr1, chr2, chr3;
		var enc1, enc2, enc3, enc4;
		var i = 0;
		input = input.replace(/[^A-Za-z0-9\`\~\-]/g, "");
		while (i < input.length) {
			enc1 = _keyStr.indexOf(input.charAt(i++));
			enc2 = _keyStr.indexOf(input.charAt(i++));
			enc3 = _keyStr.indexOf(input.charAt(i++));
			enc4 = _keyStr.indexOf(input.charAt(i++));
			chr1 = (enc1 << 2) | (enc2 >> 4);
			chr2 = ((enc2 & 15) << 4) | (enc3 >> 2);
			chr3 = ((enc3 & 3) << 6) | enc4;
			output = output + String.fromCharCode(chr1);
			if (enc3 != 64) {
				output = output + String.fromCharCode(chr2);
			}
			if (enc4 != 64) {
				output = output + String.fromCharCode(chr3);
			}
		}
		output = _utf8_decode(output);
		return output;
	}
 
	// private method for UTF-8 encoding
	_utf8_encode = function (string) {
//		string = string.replace(/\r\n/g,"\n");
		var utftext = "";
		for (var n = 0; n < string.length; n++) {
			var c = string.charCodeAt(n);
			if (c < 128) {
				utftext += String.fromCharCode(c);
			} else if((c > 127) && (c < 2048)) {
				utftext += String.fromCharCode((c >> 6) | 192);
				utftext += String.fromCharCode((c & 63) | 128);
			} else {
				utftext += String.fromCharCode((c >> 12) | 224);
				utftext += String.fromCharCode(((c >> 6) & 63) | 128);
				utftext += String.fromCharCode((c & 63) | 128);
			}
 
		}
		return utftext;
	}
 
	// private method for UTF-8 decoding
	_utf8_decode = function (utftext) {
		var string = "";
		var i = 0;
		var c = c1 = c2 = 0;
		while ( i < utftext.length ) {
			c = utftext.charCodeAt(i);
			if (c < 128) {
				string += String.fromCharCode(c);
				i++;
			} else if((c > 191) && (c < 224)) {
				c2 = utftext.charCodeAt(i+1);
				string += String.fromCharCode(((c & 31) << 6) | (c2 & 63));
				i += 2;
			} else {
				c2 = utftext.charCodeAt(i+1);
				c3 = utftext.charCodeAt(i+2);
				string += String.fromCharCode(((c & 15) << 12) | ((c2 & 63) << 6) | (c3 & 63));
				i += 3;
			}
		}
		return string;
	}
}

function stripscript(s) {
    var pattern = new RegExp("[`~!@#$^&*()=|{}':;',\\[\\].<>?~！@#￥……&*（）&;—|{}【】‘；：”“'。，、？%]")
        var rs = "";
    for (var i = 0; i < s.length; i++) {
        rs = rs + s.substr(i, 1).replace(pattern, '');
    }
    return rs;
}

//获取token
function getTyToken(url){
	var tokenstr="";
	url += "/jy_wzgl/common/getToken"
    $.ajax({
		url:url,
		type:"POST",
        async: false,
        success:function(result){
        	tokenstr = result;
		},
		error : function(){
			toastr["error"]("生成token失败","提示");
		}
    });
    return tokenstr;
}