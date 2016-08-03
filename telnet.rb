#!/usr/bin/ruby

require 'net/telnet'

command = ARGV[0]
host = ARGV[1]
print command + "\n"

a11_sdk = Net::Telnet::new("Host" => host,
    "Timeout" => 10,
    "Prompt" => /[$%#>] /)

a11_sdk.login("root") { |c| print c }
result = a11_sdk.cmd("String" => command).split("\n")
result.each { |line| print line }

if (command == "./raw_encode_init.sh")
  sleep(15)
end

sleep(1)

a11_sdk.close

