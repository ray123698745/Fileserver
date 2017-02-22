#!/usr/bin/ruby

require 'net/telnet'

command = ARGV[0]
host = ARGV[1]
print command + "\n"

a11_sdk = Net::Telnet::new("Host" => host,
    "Timeout" => 1000000,
    "Prompt" => /[$%#>] /)

a11_sdk.login("root") { |c| print c }
result = a11_sdk.cmd("String" => comand).split("\n")
result.each { |line| print line }


sleep(1)

a11_sdk.close

