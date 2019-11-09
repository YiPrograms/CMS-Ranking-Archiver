/* Programming contest management system
 * Copyright © 2012 Luca Wehrstedt <luca.wehrstedt@gmail.com>
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program. If not, see <http://www.gnu.org/licenses/>.
 */

function round(value, ndigits) {
    value *= Math.pow(10, ndigits);
    value = Math.round(value);
    value /= Math.pow(10, ndigits);
    return value;
}

function round_to_str(value, ndigits) {
    if (ndigits > 0) {
        // Remove trailing zeroes
        return value.toFixed(ndigits).replace(/\.?0+$/, "");
    } else {
        return value.toFixed(0);
    }
}

var DataStore = new function () {
    var self = this;

    self.contests = new Object();
    self.tasks = new Object();
    self.teams = new Object();
    self.users = new Object();

    self.contest_create = $.Callbacks();
    self.task_create = $.Callbacks();
    self.team_create = $.Callbacks();
    self.user_create = $.Callbacks();
    self.user_update = $.Callbacks();
    self.user_delete = $.Callbacks();

    self.score_events = $.Callbacks();
    self.rank_events = $.Callbacks();


    ////// Contest

    self.contest_count = 0;

    self.asset_config = null

    self.init_contests = function () {
        $.ajax({
            url: Config.get_contest_list_url(),
            dataType: "json",
            success: function (data, status, xhr) {
                self.contest_init_time = parseFloat(xhr.getResponseHeader("Timestamp"));
                for (var key in data) {
                    self.create_contest(key, data[key]);
                }
                self.init_tasks();
            },
            error: function () {
                console.error("Error while getting the list of contests");
                self.update_network_status(2);
            }
        });
        $.ajax({
            url: Config.get_asset_config_url(),
            dataType: "json",
            success: function (data, status, xhr) {
                self.asset_config = data;
            }
        });
    }

    self.create_contest = function (key, data) {
        data["key"] = key;
        self.contests[key] = data;

        console.info("Created contest " + key);
        console.log(data);

        self.contest_count += 1;

        self.contest_create.fire(key, data);
    };

    ////// Task

    self.task_count = 0;

    self.init_tasks = function () {
        $.ajax({
            url: Config.get_task_list_url(),
            dataType: "json",
            success: function (data, status, xhr) {
                self.task_init_time = parseFloat(xhr.getResponseHeader("Timestamp"));
                for (var key in data) {
                    self.create_task(key, data[key]);
                }
                self.inits_todo -= 1;
                if (self.inits_todo == 0) {
                    self.init_scores();
                }
            },
            error: function () {
                console.error("Error while getting the list of tasks");
                self.update_network_status(2);
            }
        });
    }

    self.create_task = function (key, data) {
        if (self.contests[data["contest"]] === undefined)
        {
            console.error("Could not find contest " + data["contest"] + " for task " + key);
            self.update_network_status(2);
            return;
        }

        data["key"] = key;
        self.tasks[key] = data;

        console.info("Created task " + key);
        console.log(data);

        self.task_count += 1;

        self.task_create.fire(key, data);
    };

    ////// Team

    self.team_count = 0;

    self.init_teams = function () {
        $.ajax({
            url: Config.get_team_list_url(),
            dataType: "json",
            success: function (data, status, xhr) {
                self.team_init_time = parseFloat(xhr.getResponseHeader("Timestamp"));
                for (var key in data) {
                    self.create_team(key, data[key]);
                }
                self.init_users();
            },
            error: function () {
                console.error("Error while getting the list of teams");
                self.update_network_status(2);
            }
        });
    }

    self.create_team = function (key, data) {
        data["key"] = key;
        self.teams[key] = data;

        console.info("Created team " + key);
        console.log(data);

        self.team_count += 1;

        self.team_create.fire(key, data);
    };

    ////// User

    self.user_count = 0;

    self.init_users = function () {
        $.ajax({
            url: Config.get_user_list_url(),
            dataType: "json",
            success: function (data, status, xhr) {
                self.user_init_time = parseFloat(xhr.getResponseHeader("Timestamp"));
                for (var key in data) {
                    self.create_user(key, data[key]);
                }
                self.inits_todo -= 1;
                if (self.inits_todo == 0) {
                    self.init_scores();
                }
            },
            error: function () {
                console.error("Error while getting the list of users");
                self.update_network_status(2);
            }
        });
    }


    self.create_user = function (key, data) {
        if (data["team"] !== null && self.teams[data["team"]] === undefined)
        {
            console.error("Could not find team " + data["team"] + " for user " + key);
            if (self.es) {
                self.es.close();
            }
            self.update_network_status(2);
            return;
        }

        data["key"] = key;
        self.users[key] = data;

        console.info("Created user " + key);
        console.log(data);

        self.user_count += 1;

        self.user_create.fire(key, data);
    };

    ////// Default scores

    self.global_max_score = 0.0;
    self.global_score_precision = 0;

    self.contest_create.add(function (key, data) {
        // Add scores
        for (var u_id in self.users) {
            self.users[u_id]["c_" + key] = 0.0;
        }
        // Maximum score
        data["max_score"] = 0.0;
        // Global score precision
        self.global_score_precision = 0;
        for (var c_id in self.contests) {
            self.global_score_precision = Math.max(self.global_score_precision, self.contests[c_id]["score_precision"]);
        }
    });

    self.task_create.add(function (key, data) {
        // Add scores
        for (var u_id in self.users) {
            self.users[u_id]["t_" + key] = 0.0;
        }
        // Maximum score
        self.contests[data["contest"]]["max_score"] += data["max_score"];
        self.global_max_score += data["max_score"];
    });

    self.user_create.add(function (key, data) {
        // Add scores
        for (var t_id in self.tasks) {
            data["t_" + t_id] = 0.0;
        }
        for (var c_id in self.contests) {
            data["c_" + c_id] = 0.0;
        }
        data["global"] = 0.0;
    });

    ////// Score

    self.init_scores = function () {
        $.ajax({
            url: Config.get_score_url(),
            dataType: "json",
            success: function (data, status, xhr) {
                self.score_init_time = parseFloat(xhr.getResponseHeader("Timestamp"));
                for (var u_id in data) {
                    for (var t_id in data[u_id]) {
                        self.set_score(u_id, t_id, data[u_id][t_id]);
                    }
                }
                self.init_ranks();
            },
            error: function () {
                console.error("Error while getting the scores");
                self.update_network_status(2);
            }
        });
    };

    self.set_score = function (u_id, t_id, new_t_score) {
        /* It may be "nice" to check that the user and task do actually exists,
           even if the server should already ensure it!
         */
        var user = self.users[u_id];
        var task = self.tasks[t_id];

        var c_id = task["contest"];
        var contest = self.contests[c_id];

        // Task
        new_t_score = round(new_t_score, task["score_precision"]);
        var old_t_score = user["t_" + t_id];
        user["t_" + t_id] = new_t_score;

        // Contest
        var new_c_score = 0.0;  // = max(user's score on t for t in contest.tasks)
        for (var i = 0; i < contest.tasks.length; i += 1) {
            new_c_score += user["t_" + contest.tasks[i].key];
        }
        new_c_score = round(new_c_score, contest["score_precision"]);
        var old_c_score = user["c_" + c_id];
        user["c_" + c_id] = new_c_score;

        // Global
        var new_g_score = 0.0;  // = max(user's score on c for c in self.contest_list)
        for (var i = 0; i < self.contest_list.length; i += 1) {
            new_g_score += user["c_" + self.contest_list[i].key];
        }
        new_g_score = round(new_g_score, self.global_score_precision);
        var old_g_score = user["global"];
        user["global"] = new_g_score;

        console.info("Changed score for user " + u_id + " and task " + t_id + ": " + old_t_score + " -> " + new_t_score);

        self.score_events.fire(u_id, user, t_id, task, new_g_score - old_g_score);
    };

    self.get_score_t = function (u_id, t_id) {
        return self.users[u_id]["t_" + t_id];
    };

    self.get_score_c = function (u_id, c_id) {
        return self.users[u_id]["c_" + c_id];
    };

    self.get_score = function (u_id) {
        return self.users[u_id]["global"];
    };


    ////// Rank

    self.init_ranks = function () {
        // Make a list of all users
        var list = new Array();

        for (var u_id in self.users) {
            list.push(self.users[u_id]);
        }

        // Sort it by decreasing score
        list.sort(function (a, b) {
            return b["global"] - a["global"];
        });

        // Assign ranks
        var prev_score = null;
        var rank = 0;
        var equal = 1;

        for (var i in list) {
            user = list[i];
            score = user["global"];

            if (score === prev_score) {
                equal += 1;
            } else {
                prev_score = score;
                rank += equal;
                equal = 1;
            }

            user["rank"] = rank;
        }

        self.user_create.add(function (u_id, user) {
            /* We're actually just counting how many users have a non-zero
               global score and setting the rank of the new user to that number
               plus one. An optimization could be to store that number and to
               keep it up-to-date (instead of computing it every time). But
               since user creation is a rare event we could keep it this way.
             */
            var new_rank = 1;

            for (var u_id in self.users) {
                if (self.users[u_id]["global"] > user["global"]) {
                    new_rank += 1;
                }
            }

            user["rank"] = new_rank;
        });

        self.user_update.add(function (u_id, old_user, user) {
            user["rank"] = old_user["rank"];
            delete old_user["rank"];
        });

        self.user_update.add(function (u_id, old_user) {
            /* We're assuming that the user has its score set to zero and thus
               has the highest possible rank (this is because the server should
               have already deleted all its submissions and subchanges). So its
              deletion won't cause changes in others' ranks.
             */
            delete old_user["rank"];
        });

        self.init_selections();
    };


    ////// Initialization

    /* The init process works this way:
       - we start init_contests() and init_teams()
       - they each start an asynchronous AJAX request
       - when the requests end their data is processed and then, respectively,
         init_tasks() and init_users() are called
       - they also start an AJAX request and process its data
       - when BOTH requests finish init_scores() is called
       - it does again an AJAX request and processes its data
       - at the end it calls init_ranks() which calls init_selections() which,
         in turn, calls init_callback()
     */

    self.init = function (callback) {
        self.inits_todo = 2;
        self.init_callback = callback;

        self.init_contests();
        self.init_teams();
        if (self.network_state == 0) self.update_network_status(1)
    };


    ////// Event listeners

    /* We set the listeners for Server Sent Events. */

    self.network_state = 0;

    self.update_network_status = function (state) {
        self.network_state = state;
        if (state == 0) {
            $("#ConnectionStatus_box").attr("data-status", "reconnecting");
            $("#ConnectionStatus_text").text("You are downloading the archived data from the server...");
            $("#ConnectionStatus_label").html("Loading");
        } else if (state == 1) {
            $("#ConnectionStatus_box").attr("data-status", "connected");
            $("#ConnectionStatus_text").html("The archived data are successfully loaded");
            $("#ConnectionStatus_label").html("Archived");
        } else if (state == 2) {
            $("#ConnectionStatus_box").attr("data-status", "init_error");
            $("#ConnectionStatus_text").html("An error occurred while loading the data. Check your connection and <a onclick=\"window.location.reload();\">reload the page</a>.");
            $("#ConnectionStatus_label").html("Error");
        }
    };

    $(document).ready(function () {
        self.update_network_status(0);
    });


    ////// Sorted contest list

    self.contest_list = new Array();

    self.contest_list_insert = function (key, data) {
        // Insert data in the sorted contest list
        var a = data;
        for (var i = 0; i < self.contest_list.length; i += 1) {
            var b = self.contest_list[i];
            if ((a["begin"] < b["begin"]) || ((a["begin"] == b["begin"]) &&
               ((a["end"]   < b["end"]  ) || ((a["end"]   == b["end"]  ) &&
               ((a["name"]  < b["name"] ) || ((a["name"]  == b["name"] ) &&
               (key < b["key"]))))))) {
                // We found the first element which is greater than a
                self.contest_list.splice(i, 0, a);
                return;
            }
        }
        self.contest_list.push(a);
    };

    self.contest_create.add(function (key, data) {
        data["tasks"] = new Array();
        self.contest_list_insert(key, data);
    });


    ////// Sorted task list

    self.task_list_insert = function (key, data) {
        var task_list = self.contests[data["contest"]]["tasks"];

        // Insert data in the sorted task list of the contest
        var a = data;
        for (var i = 0; i < task_list.length; i += 1) {
            var b = task_list[i];
            if ((a["order"] < b["order"]) || ((a["order"] == b["order"]) &&
               ((a["name"]  < b["name"] ) || ((a["name"]  == b["name"] ) &&
               (key < b["key"]))))) {
                // We found the first element which is greater than a
                task_list.splice(i, 0, a);
                return;
            }
        }
        task_list.push(a);
    };

    self.task_create.add(self.task_list_insert);

    ////// Sorted team list

    self.team_list = new Array();

    self.team_list_insert = function (key, data) {
        // Insert data in the sorted team list
        var a = data;
        for (var i = 0; i < self.team_list.length; i += 1) {
            var b = self.team_list[i];
            if ((a["name"] < b["name"]) || ((a["name"] == b["name"]) &&
                (key < b["key"]))) {
                // We found the first element which is greater than a
                self.team_list.splice(i, 0, a);
                return;
            }
        }
        self.team_list.push(a);
    };

    self.team_create.add(function (key, data) {
        data["users"] = new Array();
        self.team_list_insert(key, data);
    });


    ////// Sorted user list

    self.user_list_insert = function (key, data) {
        if (data["team"] == null) {
            return;
        }

        var user_list = self.teams[data["team"]]["users"];

        // Insert data in the sorted user list of the team
        var a = data;
        for (var i = 0; i < user_list.length; i += 1) {
            var b = user_list[i];
            if ((a["l_name"] < b["l_name"]) || ((a["l_name"] == b["l_name"]) &&
               ((a["f_name"] < b["f_name"]) || ((a["f_name"] == b["f_name"]) &&
               (key < b["key"]))))) {
                // We found the first element which is greater than a
                user_list.splice(i, 0, a);
                return;
            }
        }
        user_list.push(a);
    };

    self.user_list_remove = function (key, old_data) {
        if (old_data["team"] == null) {
            return;
        }

        var user_list = self.teams[old_data["team"]]["users"];

        // Remove data from the sorted user list of the team
        for (var i = 0; i < user_list.length; i += 1) {
            var b = user_list[i];
            if (key == b["key"]) {
                user_list.splice(i, 1);
                break;
            }
        }
    };

    self.user_create.add(self.user_list_insert);
    self.user_update.add(function (key, old_data, data) {
        self.user_list_remove(key, old_data);
        self.user_list_insert(key, data);
    });
    self.user_delete.add(self.user_list_remove);


    ////// Selection

    self.select_events = $.Callbacks();

    /* We use eight different colors. We keep track of how many times each
       color is in use and when we have to assign a new color to an user we
       choose the one that has been used less times.
     */

    self.colors = [0,0,0,0,0,0,0,0]

    self.choose_color = function () {
        var min_idx = 0;
        for (var i = 1; i < 8; i += 1)
        {
            if (self.colors[i] < self.colors[min_idx])
            {
                min_idx = i;
            }
        }
        // Color indexes will be 1-based, so we add 1 to the result
        return min_idx+1;
    }

    self.init_selections = function () {
        $.each(self.users, function (u_id) {
            var color_idx = parseInt(localStorage.getItem("cms.rws.selection.users." + u_id));
            if (color_idx > 0)
            {
                self.set_selected(u_id, true, color_idx);
            }
        });

        $(window).on("storage", function (event) {
            event = event.originalEvent;
            if (event.storageArea == localStorage)
            {
                if (event.key === null)
                {
                    // Triggered by a .clear().
                    $.each(self.users, function (u_id) {
                        self.set_selected(u_id, false);
                    });
                }
                else if (event.key.lastIndexOf("cms.rws.selection.users.", 0) === 0)
                {
                    var u_id = event.key.substr(24);
                    if (event.oldValue === null && event.newValue !== null)
                    {
                        self.set_selected(u_id, true, parseInt(event.newValue));
                    }
                    else if (event.oldValue !== null && event.newValue === null)
                    {
                        self.set_selected(u_id, false);
                    }
                }
            }
        });

        self.init_callback();
    };

    self.set_selected = function (u_id, flag, color_idx) {
        if (self.users[u_id]["selected"] == 0 && flag) {
            // We have to assign a color
            if (!(color_idx > 0))
            {
                color_idx = self.choose_color();
            }
            self.users[u_id]["selected"] = color_idx;
            self.colors[color_idx-1] += 1;
            localStorage.setItem("cms.rws.selection.users." + u_id, color_idx);
            self.select_events.fire(u_id, color_idx);
        }
        else if (self.users[u_id]["selected"] != 0 && !flag) {
            // We have to remove the color
            var color_idx = self.users[u_id]["selected"];
            self.users[u_id]["selected"] = 0;
            self.colors[color_idx-1] -= 1;
            localStorage.removeItem("cms.rws.selection.users." + u_id);
            self.select_events.fire(u_id, 0);
        }
    };

    self.toggle_selected = function (u_id) {
        self.set_selected(u_id, self.users[u_id]["selected"] == 0);
    };

    self.get_selected = function (u_id) {
        return self.users[u_id]["selected"];
    };

    self.user_create.add(function (key, data) {
        data["selected"] = 0;
    });

    self.user_update.add(function (key, old_data, data) {
        data["selected"] = old_data["selected"];
        delete old_data["selected"];
    });

    self.user_delete.add(function (key, old_data) {
        self.set_selected(key, false);
        delete old_data["selected"];
    });
};
