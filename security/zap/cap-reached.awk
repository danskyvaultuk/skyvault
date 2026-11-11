# Reads a ZAP log on stdin and prints yes when any capped job's own "time taken" is within five seconds of its
# cap, else no. Caps are given in seconds: -v spider=N -v passive=N -v active=N.
# Lines read: "Job <name> finished, time taken: HH:MM:SS". The "set maxDuration" config echoes are not read.
BEGIN { cap["spider"] = spider; cap["passiveScan-wait"] = passive; cap["activeScan"] = active; hit = "no" }
/Job [^ ]+ finished, time taken: [0-9]+:[0-9][0-9]:[0-9][0-9]/ {
  match($0, /Job [^ ]+ finished/)
  job = substr($0, RSTART + 4, RLENGTH - 13)
  match($0, /time taken: [0-9]+:[0-9][0-9]:[0-9][0-9]/)
  split(substr($0, RSTART + 12, RLENGTH - 12), t, ":")
  taken = t[1] * 3600 + t[2] * 60 + t[3]
  if ((job in cap) && taken >= cap[job] - 5) hit = "yes"
}
END { print hit }
