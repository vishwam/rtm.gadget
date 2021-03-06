var rtm = {
	serviceURL: "http://api.rememberthemilk.com/services/rest/",
	authURL: "http://www.rememberthemilk.com/services/auth/",
	cache: {
		defaultFilter: "status:incomplete",
		currentFilter: this.defaultFilter,
		tasks: {
			_list: [],
			get: function() {
				return this._list;
			},
			clear: function() {
				this._list.length = 0;
			},
			comparator: function(p,q) {
				return 0;
			},
			add: function(response) {
				if (response.tasks == undefined) return -1;
				if (response.tasks.list == undefined) return 0;
				
				var lists = rtm.makeArray (response.tasks.list);
				for (i in lists) {
					var tasks = rtm.makeArray (lists[i].taskseries);
					for (j in tasks) {
						tasks[j].list = lists[i].id;
						this._list.push (tasks[j]);
					}
				}
				//this._list.sort (this.comparator);	
			}, // end of add()
		}, // end of object tasks
	}, // end of object cache
	
	
	/**
	 * makeArray
	 * Intended to wrap around crazy functions like rtm.tasks.getList that
	 * can return an array (holding multiple objects), object (if only one
	 * object matches a query, or nothing at all (no objects match the query).
	 * This function ensures the output in all cases is an array that can
	 * safely be used in a for..each loop.
	 * @param input: an array, a plain object, or undefined.
	 * @return an array holding all the objects in the input.
	 */
	makeArray: function (input) {
		if (input == undefined) return [];
		if ($.isArray(input)) return input;
		return [input];
	}, // end of getArray
	
	/**
	 * signRequest 
	 * Adds the "api_sig" parameter to authenticate a request, using the
	 * application's shared secret. Requires the 'auth' object, containing
	 * the api_key and shared_secret to be present.
	 * See http://www.rememberthemilk.com/services/api/authentication.rtm
	 * This method can also add frequently used parameters, such as the 
	 * api_key, format and the auth_token (if present), if needed.
	 *
	 * @param the data to be signed, in an associative array
	 * e.g., {"method":"rtm.test.login", "api_key":"foo"}
	 * @param disableAutoAdd (optional). If true, frequently used parameters
	 * (e.g., API key, format, token) are *not* added. 
	 * @return the same array, with an "api_sig" parameter added.
	 */
	signRequest: function (params, disableAutoAdd) {
		if (!disableAutoAdd) {
			delete params["api_sig"]; // remove the signature if already present.
			// add other frequent paramters, just in case
			params["api_key"] = auth.api_key;
			params["format"] = "json";
			if (auth.token != undefined) params["auth_token"] = auth.token;
		}
		
		// sort the keys in alphabetical order
		var keys = [];
		$.each (params, function (key) {
			keys.push (key);
		});
		keys.sort();
		
		var str = auth.shared_secret;
		$.each (keys, function (index, key) {
			str += (key + params[key]);
		});
		
		params["api_sig"] = hex_md5(str);
		return params;
	}, // end signRequest
	
	getFrob: function () {
		var params = rtm.signRequest ({"method": "rtm.auth.getFrob"});
		$.getJSON (rtm.serviceURL, params, function (data) {
			var response = data.rsp;
			if (rtm.isCorrectResponse(response)) {
				auth.frob = response.frob;
			}
			else rtm.handleErrorResponse (response);
		});
	}, // end getFrob
	
	
	/**
	 * getAuthenticationURL
	 * This method generates the URL where the user can grant access
	 * to the application with the desired permisiions (rwd).
	 * Requires auth.frob to be present.
	 * @param none
	 * @return string containing the URL.
	 */
	getAuthenticationURL: function () {
		return rtm.authURL + "?" + $.param(
			rtm.signRequest ({
				"api_key":auth.api_key,
				"frob":auth.frob, 
				"perms":"delete",
			}, true) // sign request without adding new parameters
		); 
	}, // end getAuthentication
	
	/** 
	 * getToken
	 * Gets the authentication token, plus the user credentials and adds it to 
	 * the auth object.
	 * Requires auth.frob to be present
	 * @param none
	 * @return none: if successful, the token and user info are added to auth.
	 */
	getToken: function () {
		var params = rtm.signRequest ({"frob":auth.frob, "method":"rtm.auth.getToken"});
		$.getJSON (rtm.serviceURL, params, function (data) {
			var response = data.rsp;
			if (rtm.isCorrectResponse(response)) {
				// deep copy all elements in the response into the auth object.
				$.extend (true, auth, response.auth);
			}
			else rtm.handleErrorResponse (response);
		});
	}, // end of getToken
	
	checkToken: function () {
		if (auth.token == undefined) {
			rtm.getToken();
			return;
		}
		
		var params = rtm.signRequest ({"method":"rtm.auth.checkToken"});
		$.getJSON (rtm.serviceURL, params, function (data) {
			var response = data.rsp;
			if (rtm.isCorrectResponse(response)) {
				// deep copy all elements in the response into the auth object.
				$.extend (true, auth, response.auth);
			}
			else rtm.handleErrorResponse (response);
		});
	}, // end of checkToken
	
	createTimeline: function () {
		var params = rtm.signRequest ({"method":"rtm.timelines.create"});
		$.getJSON (rtm.serviceURL, params, function (data) {
			var response = data.rsp;
			if (rtm.isCorrectResponse(response)) {
				auth["timeline"] = response.timeline;
			}
			else rtm.handleErrorResponse (response);
		});
	}, // end createTimeline
	
	/**
	 * getTasks
	 * Gets all tasks matching a given filter.
	 * Requires auth token to be present.
	 * @param filter (optional: if not present, the default filter is used).
	 * @return none: if request is successful, all tasks matching the filter
	 * are added to the cache.tasks object.
	 */
	getTasks: function (filter) {
		if (filter == undefined) filter = rtm.cache.defaultFilter;
		var params = {"method":"rtm.tasks.getList", "filter":filter};
		var isNewFilter = (filter != rtm.cache.currentFilter);
		if (!isNewFilter) params["last_sync"] = rtm.cache.lastSyncedAt;
				
		$.getJSON (rtm.serviceURL, rtm.signRequest(params), function(data) {
			var response = data.rsp;
			if (rtm.isCorrectResponse(response)) {
				if (isNewFilter) {
					rtm.cache.currentFilter = filter;
					rtm.cache.tasks.clear();
				}
				rtm.cache.lastSyncedAt = null; // @todo get current time
				rtm.cache.tasks.add (response);
			}
			else rtm.handleErrorResponse (response);
		});
	}, // end getTasks
	
	isCorrectResponse: function (response) {
		return (response.stat == "ok");
	}, // end isValidResponse
	
	handleErrorResponse: function (response) {
		alert (response.err.code + ": "+response.err.msg);
	}, // end handleErrorResponse

	timeUtils: {
		getISO8601: function (date) {
			// from https://developer.mozilla.org/en/JavaScript/Reference/Global_Objects/Date#Example.3a_ISO_8601_formatted_dates
			if (date === undefined) date = new Date();
			function pad(n){return n<10 ? '0'+n : n}
			return date.getUTCFullYear()+'-'
				+ pad(date.getUTCMonth()+1)+'-'
				+ pad(date.getUTCDate())+'T'
				+ pad(date.getUTCHours())+':'
				+ pad(date.getUTCMinutes())+':'
				+ pad(date.getUTCSeconds())+'Z';
		}, // end getISO8601
		
		parseISO8601: function(dString){
			// from http://dansnetwork.com/2008/11/01/javascript-iso8601rfc3339-date-parser/
			var date = new Date();
			date.setTime (0); // reset time to start of epoch
			
			var regexp = /(\d\d\d\d)(-)?(\d\d)(-)?(\d\d)(T)?(\d\d)(:)?(\d\d)(:)?(\d\d)(\.\d+)?(Z|([+-])(\d\d)(:)?(\d\d))/;
			var d = (dString === undefined) ? "" : dString.toString().match(regexp);
			if (d) {
				var offset = 0;
				date.setUTCDate(1);
				date.setUTCFullYear(parseInt(d[1],10));
				date.setUTCMonth(parseInt(d[3],10) - 1);
				date.setUTCDate(parseInt(d[5],10));
				date.setUTCHours(parseInt(d[7],10));
				date.setUTCMinutes(parseInt(d[9],10));
				date.setUTCSeconds(parseInt(d[11],10));
				date.setUTCMilliseconds(d[12] ? (parseFloat(d[12]) * 1000) : 0);
				if (d[13] != 'Z') {
					offset = (d[15] * 60) + parseInt(d[17],10);
					offset *= ((d[14] == '-') ? -1 : 1);
					date.setTime(date.getTime() - offset * 60 * 1000);
				}
			} else {
				date.setTime(Date.parse(dString));
			}
			return date;
		} // end setISO8601

	} // end timeUtils
} // end rtm